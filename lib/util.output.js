"use strict";

const chalk = require('chalk');
const util = require('util');
const moment = require('moment');
const Timer = require('./util.timer');

class Output {
    constructor(namespace, debug) {
        this.namespace = namespace;
        this._last = null;
        this.debug = debug;
        if (this.debug)
            this.Debug("Debugging");
    }

    /**
     * @return {string}
     */
    get LapTime() {
        if (this._last == null) {
            this._last = new moment();
            return "+0 sec";
        }
        else {
            let diff = moment().diff(this._last, "seconds");
            this._last = new moment();
            return util.format("+%s sec", diff);
        }
    }

    get header() {
        return chalk.blue.bold(util.format("%s [%s]: ", this.namespace, this.LapTime));
    }

    /**
     * @param color
     * @returns {function(*=)}
     */
    static formatter(color) {
        return obj => {
            if (typeof obj == "string")
                return chalk[color](obj);
            return obj;
        }
    }

    Debug() {
        if (this.debug) {
            var args = Array.from(arguments).map(Output.formatter("magenta"));
            args.unshift(this.header);
            console.log.apply(console, args);
        }
    }

    Log() {
        var args = Array.from(arguments).map(Output.formatter("green"));
        args.unshift(this.header);
        console.log.apply(console, args);
    }

    Warn() {
        var args = Array.from(arguments).map(Output.formatter("yellow"));
        args.unshift(this.header);
        console.log.apply(console, args);
    }

    Error() {
        var args = Array.from(arguments).map(Output.formatter("red"));
        args.unshift(this.header);
        console.error.apply(console, args);
    }

    Timer(title, immediate) {
        if (!this.debug)
            return new Timer(title, immediate);
        else {
            return {
                stop: function () {
                    return false
                },
                start: function () {
                    return false
                }
            };
        }
    }
}
module.exports = Output;