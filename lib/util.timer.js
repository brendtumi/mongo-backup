"use strict";

class twirlTimer {
	constructor(immediate) {
		this.interval = null;
		if (immediate)
			this.start();
	}

	start() {
		var P = ["\\", "|", "/", "-"];
		var x = 0;
		return this.interval = setInterval(function () {
			process.stdout.write("\r" + P[x++]);
			x &= 3;
		}, 250);
	}

	stop() {
		clearInterval(this.interval);
	}
}

module.exports = twirlTimer;