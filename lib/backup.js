"use strict";

const async = require('async');
const util = require('util');
const moment = require('moment');
const mongodb = require('mongodb');
const tmp = require('tmp');
const fs = require('graceful-fs');
const nodemailer = require('nodemailer');
const request = require('request');
const aws = require('aws-sdk');
const Timer = require('./util.timer');
const Out = require('./util.output');

const timer = new Timer();
tmp.setGracefulCleanup();

class Backup {
	constructor(configuration) {
		this.configuration = configuration;
	}

	static mongoOptions(opts) {
		let options = [];
		for (let opt in opts) {
			if (["type", "archive"].indexOf(opt) > -1)
				continue;
			else {
				options.push(util.format("--%s", opt));
				if (opts[opt])
					options.push(opts[opt]);
			}
		}
		return options;
	}

	hook(logger, hook, type, from, result, callback) {
		switch (hook.type) {
			case "nodejs":
				try {
					require(hook.file)(hook, type, from, result, callback);
				}
				catch (err) {
					callback(err);
				}
				break;
			case "nodemailer":
				let transporter = nodemailer.createTransport(hook.smtp);

				if (result) {
					if (hook.options.text)
						hook.options.text = util.format(hook.options.text, util.inspect(result));
					if (hook.options.html)
						hook.options.html = util.format(hook.options.html, util.inspect(result));
				}

				transporter.sendMail(hook.options, callback);
				break;
			case "request":
				let opt = {url: hook.url};
				if (result) {
					opt.method = "post";
					opt.body = result;
					opt.json = true;
				}
				request(opt, function (error, response) {
					if (response.statusCode != 200)
						logger.Warn("Hook request receive different result than OK(200)", hook);

					if (!error)
						callback();
					else
						callback(error);
				});
				break;
			default:
				fs.access('../hooks/' + hook.type, fs.constants.R_OK | fs.constants.X_OK, (err) => {
					if (err)
						callback(err);
					else
						require('../hooks/' + hook.type)(hook, type, from, result, callback);
				});
				break;
		}
	}

	mongoDump(part, step, callback) {
		let opts = Backup.mongoOptions(part.from);
		switch (part.from.archive) {
			case "gzip":
				opts.push("--gzip");
				step.dump.name = step.dump.name + ".gz";
				step.dump.output = require('path').join(step.dump.tmp, step.dump.name);
				opts.push(util.format("--archive=%s", step.dump.output));
				break;
			default:
				step.dump.output = require('path').join(step.dump.tmp, step.dump.name);
				opts.push(util.format("--out=%s", step.dump.output));
				break;
		}
		timer.start();
		let spawn = require('child_process').spawn;
		let mongodump = spawn('mongodump', opts);

		mongodump.on('exit', function (code) {
			timer.stop();
			if (code === 0) {
				if (!part.from.archive || part.from.archive == "tar") {
					step.dump.name = step.dump.name + ".tar.gz";
					let output = require('path').join(step.dump.tmp, step.dump.name);
					let mongodump = spawn('tar', ['-zcvf', output, step.dump.output]);
					timer.start();
					mongodump.on('exit', function (code) {
						timer.stop();
						if (code === 0) {
							step.dump.output = output;
							callback(null, step);
						}
						else
							callback(util.format("tar exited with code %s", code), step);
					});
				}
				else if (part.from.archive && part.from.archive == "zip") {
					step.dump.name = step.dump.name + ".zip";
					let output = require('path').join(step.dump.tmp, step.dump.name);
					let mongodump = spawn('zip', ['-r', output, step.dump.output]);
					timer.start();
					mongodump.on('exit', function (code) {
						timer.stop();
						if (code === 0) {
							step.dump.output = output;
							callback(null, step);
						}
						else
							callback(util.format("zip exited with code %s", code), step);
					});
				}
				else
					callback(null, step);
			}
			else
				callback(util.format("Mongodump exited with code %s", code), step);
		});
	}

	/**
	 *
	 * @param {Object} part
	 * @param {Output} logger
	 * @param {function} wCallBack
	 */
	worker(part, logger, wCallBack) {
		let _this = this;
		async.waterfall(
			[
				callback => {
					logger.Log("Applying pre-hooks");
					let step = {
						part: util.format("%s %s", part.from.type, part.from.host),
						steps: {
							1: moment().format(),
							2: null,
							3: null,
							4: null,
						}
					};

					if (part.hooks && part.hooks.before && part.hooks.before.length > 0) {
						async.each(
							part.hooks.before,
							(hook, cb) => {
								_this.hook(logger, hook, "before", part.from, null, cb);
							},
							err => {
								callback(err, step);
							}
						);
					}
					else callback(null, step);
				},
				(step, callback) => {
					logger.Log("Dumping database");
					step.steps[2] = moment().format();
					tmp.dir({unsafeCleanup: true}, (err, path, cleanupCallback) => {
						if (err) callback(err);
						else {
							step.dump = {
								tmp: path,
								cleanup: cleanupCallback,
								name: moment().format("YYYY-MM-DD_HH-mm")
							};

							_this.mongoDump(part, step, callback);
						}
					});
				},
				(step, callback) => {
					logger.Log("Processing backup");
					step.steps[3] = moment().format();
					switch (part.to.type) {
						case "s3":
							let s3 = new aws.S3({
									accessKeyId: part.to.accessKeyId,
									secretAccessKey: part.to.secretAccessKey,
									region: part.to.region,
									apiVersion: '2006-03-01',
									computeChecksums: true
								}
							);
							let body = fs.createReadStream(step.dump.output);
							let params = {
								Bucket: part.to.bucket,
								Key: require('path').join(part.to.folder, step.dump.name),
								Body: body
							};
							s3.upload(params, function (err, data) {
								if (!err)
									step.to = [data];
								callback(err, step);
							});
							break;
						default:
							callback("No store type found", step);
							break;
					}
				}
			],
			(err, result) => {
				if (result.dump && result.dump.cleanup) {
					result.dump.cleanup();
					delete result.dump.cleanup;
				}

				if (err) {
					if (part.hooks && part.hooks.fail && part.hooks.fail.length > 0) {
						async.each(
							part.hooks.fail,
							(hook, cb) => {
								_this.hook(logger, hook, "fail", part.from, err, cb);
							},
							wCallBack
						);
					}
					else wCallBack(err);
				}
				else {
					result.steps[4] = moment().format();
					if (part.hooks && part.hooks.done && part.hooks.done.length > 0) {
						async.each(
							part.hooks.done,
							(hook, cb) => {
								_this.hook(logger, hook, "done", part.from, result, cb);
							},
							wCallBack
						);
					}
					else wCallBack();
				}
			}
		);
	}

	start() {
		return new Promise((resolve, reject) => {
			let _this = this;
			let i = 0;
			async.each(
				_this.configuration,
				(part, cb) => {
					let logger = new Out(util.format("Part [%s]", ++i));
					_this.worker(part, logger, cb);
				},
				err => {
					if (err)
						reject(err);
					else
						resolve("Jobs Done.");
				});
		});

	}
}

module.exports = Backup;