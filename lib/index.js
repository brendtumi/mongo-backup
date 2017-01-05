"use strict";

const realFs = require('fs');
const util = require('util');
const fs = require('graceful-fs');
fs.gracefulify(realFs);
const jsonfile = require('jsonfile');
const Backup = require('./backup');
const out = require('./util.output');

let Logger = new out("Main");

module.exports = {
    example: function (path) {
        let ex = [require("./conf-part")];
        fs.access('./examples/conf.json', fs.R_OK, err => {
            if (!err)
                ex = jsonfile.readFileSync('./examples/conf.json');

            jsonfile.writeFile(path, ex, err => {
                if (err) {
                    Logger.Error('File not generated.');
                    process.exit(100);
                }
                else
                    Logger.Log('File generated.', path);
            });
        });
    },
    run: function (configFile, options) {
        Logger.Log("Starting backup process");
        fs.access(configFile, fs.R_OK, err => {
            if (err) {
                Logger.Error(util.format('Insufficient permission to access file %s', configFile));
                process.exit(101);
            }
            else {
                jsonfile.readFile(configFile, (err, config) => {
                    if (err) {
                        Logger.Error(util.format("configuration error: %s", err.message), configFile);
                        process.exit(102);
                    }
                    else {
                        if (options.cron) {
                            let CronJob = require('cron').CronJob;
                            try {
                                new CronJob(options.cron, () => {
                                    let BK = new Backup(config);
                                    BK.start({debug: !!options.debug})
                                        .then(
                                            msg => {
                                                Logger.Log("Backup successful");
                                                Logger.Log(msg);
                                            },
                                            error => {
                                                Logger.Error("Backup Failed");
                                                Logger.Error(error);
                                            }
                                        );
                                }, null, true);
                            }
                            catch (ex) {
                                Logger.Error("Cron pattern isn't valid");
                                process.exit(9);
                            }
                        }
                        else {
                            let BK = new Backup(config, options.tmp);
                            BK.start({debug: !!options.debug})
                                .then(
                                    msg => {
                                        Logger.Log("Backup successful");
                                        Logger.Log(msg);
                                    },
                                    error => {
                                        Logger.Error("Backup Failed");
                                        Logger.Error(error);
                                    }
                                );
                        }
                    }
                });
            }
        });
    }
};