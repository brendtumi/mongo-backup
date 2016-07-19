"use strict";

const chalk = require('chalk');
const util = require('util');
const moment = require('moment');

class Output {
	constructor(namespace) {
		this.namespace = namespace;
		this._last = null;
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
}
module.exports = Output;