"use strict";

const async = require('async');
const util = require('util');
const path = require('path');
const moment = require('moment');
const mongodb = require('mongodb');
const tmp = require('tmp');
const fs = require('graceful-fs');
const nodemailer = require('nodemailer');
const request = require('request');
const aws = require('aws-sdk');
const Out = require('./util.output');

tmp.setGracefulCleanup();

class Backup {
    constructor(configuration, tmpFolder) {
        this.configuration = configuration;
        this.tmpFolder = tmpFolder && path.isAbsolute(tmpFolder) ? path.normalize(tmpFolder) : null;
    }

    static mongoOptions(opts) {
        let options = [];
        for (let opt in opts) {
            if (["type", "archive", "dateFormat"].indexOf(opt) > -1)
                continue;
            else {
                let arr = [];
                if (!Array.isArray(opts[opt])) arr = [opts[opt]];
                else arr = [...opts[opt]];
                arr.forEach(function(o) {
                    options.push(util.format("--%s", opt));
                    if (o) options.push(o);
                });
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

    mongoDump(part, step, logger, callback) {
        let opts = Backup.mongoOptions(part.from);
        switch (part.from.archive) {
            case "gzip":
                opts.push("--gzip");
                step.dump.name = step.dump.name + ".gz";
                step.dump.output = path.join(step.dump.tmp, step.dump.name);
                opts.push(util.format("--archive=%s", step.dump.output));
                break;
            default:
                step.dump.output = path.join(step.dump.tmp, step.dump.name);
                opts.push(util.format("--out=%s", step.dump.output));
                break;
        }
        let mongoTimer = logger.Timer("Dumping MongoDB", true);
        let spawn = require('child_process').spawn;
        let mongodump = spawn('mongodump', opts);

        let mongodumpLogs = [];
        mongodump.stdout.on('data', (data) => {
            mongodumpLogs.push(`stdout: ${data}`);
            logger.Debug(data.toString());
        });

        mongodump.stderr.on('data', (data) => {
            mongodumpLogs.push(`stderr: ${data}`);
            logger.Debug(data.toString());
        });

        mongodump.on('exit', function (code) {
            mongoTimer.stop();
            if (code === 0) {
                if (!part.from.archive || part.from.archive == "tar") {
                    let compressName = step.dump.name + ".tar.gz";
                    let tar = spawn('tar', ['-zcvf', compressName, step.dump.name], {cwd: step.dump.tmp});
                    let tarTimer = logger.Timer("Compressing tar file", true);
                    tar.on('exit', function (code) {
                        tarTimer.stop();
                        if (code === 0) {
                            step.dump.name = compressName;
                            step.dump.output = path.join(step.dump.tmp, step.dump.name);
                            callback(null, step);
                        }
                        else
                            callback(util.format("tar exited with code %s", code), step);
                    });
                }
                else if (part.from.archive && part.from.archive == "zip") {
                    let compressName = step.dump.name + ".zip";
                    let zip = spawn('zip', ['-r', compressName, step.dump.name], {cwd: step.dump.tmp});
                    let zipTimer = logger.Timer("Compressing zip file", true);
                    zip.on('exit', function (code) {
                        zipTimer.stop();
                        if (code === 0) {
                            step.dump.name = compressName;
                            step.dump.output = path.join(step.dump.tmp, step.dump.name);
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
                callback({error: util.format("Mongodump exited with code %s", code), logs: mongodumpLogs}, step);
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
                    tmp.dir({unsafeCleanup: true, dir: this.tmpFolder}, (err, pth, cleanupCallback) => {
                        if (err) callback(err);
                        else {
                            step.dump = {
                                tmp: pth,
                                cleanup: cleanupCallback,
                                name: moment().format(part.from.dateFormat || "YYYY-MM-DD_HH-mm")
                            };

                            _this.mongoDump(part, step, logger, callback);
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
                                Key: path.join(part.to.folder, part.to.name || step.dump.name),
                                Body: body
                            };
                            s3.upload(params, function (err, data) {
                                if (!err)
                                    step.to = [data];
                                callback(err, step);
                            });
                            break;
                        case "dropbox":
                            const Dropbox = require('dropbox');
                            let dbx = new Dropbox({accessToken: part.to.accessToken});
                            body = fs.createReadStream(step.dump.output);
                            dbx.filesUpload({ path: '/personal/Apps/settlin/localhost/mongodb/' + moment.format('YYYY-MM-DD') + '.tgz', contents: body}, function(err, data) {
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
                if (result && result.dump && result.dump.cleanup) {
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

    start(opts) {
        return new Promise((resolve, reject) => {
            let _this = this;
            let i = 0;
            async.each(
                _this.configuration,
                (part, cb) => {
                    let logger = new Out(util.format("Part [%s]", ++i), opts.debug);
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