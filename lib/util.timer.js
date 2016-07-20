"use strict";

const ProgressBar = require('progress');

class Timer {
	constructor(title, immediate) {
		this.interval = null;
		this.title = title || "Processing";
		this.bar = new ProgressBar('  :title [:bar]', {
			complete: '='
			, incomplete: ' '
			, width: 30
			, total: 100
		});
		if (immediate)
			this.start();
	}

	start() {
		let _this = this;
		let forward = true;

		_this.interval = setInterval(function () {
			if (forward)
				_this.bar.tick(1, {title: _this.title});
			else
				_this.bar.tick(-1, {title: _this.title});


			if (_this.bar.curr > 98)
				forward = false;
			if (_this.bar.curr <= 2)
				forward = true;
		}, 50);

		return _this.interval;
	}

	stop() {
		clearInterval(this.interval);
		this.bar.terminate();
	}
}

module.exports = Timer;