var sys = require("sys");
var net = require("net");
var color = require("ansi-color").set;
var config = require('./../etc/nodast.js').config;

var syslog = require('node-syslog').Syslog;

syslog.init("nodast", syslog.LOG_PID | syslog.LOG_ODELAY, syslog.LOG_INFO);

process.on('uncaughtException', function(error) {
	syslog.log(syslog.LOG_ERROR, error);
});

var proxy = function() {

	var handler = function(proxySocket) {

		var buffer = [];

		proxySocket.setEncoding('ascii');

		var serviceSocket;
		var connected = false;

		proxySocket.on("data", function(data) {
			console.log("<" + data);
			if (!connected && serviceSocket === undefined) {
				buffer.push(data);

				if (data.indexOf('agi_request') == -1) {
					return;
				}

				var destination = require('./processor.js').process(data);

				syslog.log(syslog.LOG_INFO, 'request in for ' + destination.hostname + ':' + destination.port);

				serviceSocket = new net.Socket();
				serviceSocket.setEncoding('ascii');
				serviceSocket.on("data", function(data) {
					console.log(">" + data);
					proxySocket.write(data);
				});
				serviceSocket.on("close", function(had_error) {
					proxySocket.end();
				});

				serviceSocket.on('connect', function(socket) {
					for ( var int = 0; int < buffer.length; int++) {
						var line = buffer[int];
						serviceSocket.write(line);
					}
				});

				serviceSocket.connect(destination.port, destination.hostname);
			} else {
				serviceSocket.write(data);
			}
		});
		proxySocket.on("close", function(had_error) {
			serviceSocket.end();
		});
	};
	var proxy = net.createServer();
	proxy.on('connection', handler);
	proxy.on('close', function() {
		syslog.log(syslog.LOG_INFO, "terminating");
	});
	syslog.log(syslog.LOG_INFO, 'starting ' + exports.name + " v"
			+ exports.version + ' on ' + config.listen);
	proxy.listen(config.listen);
};

exports.name = "nodast";
exports.version = "0.0.1";
exports.start = proxy;