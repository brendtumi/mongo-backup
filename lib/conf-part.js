/**
 * Created by tumay on 14.07.2016.
 */
module.exports = {
	"from": {
		"type": "mongodb",
		"host": "127.0.0.1",
		"port": 27017,
		"authenticationDatabase": "admin",
		"database": "",
		"username": "",
		"password": "",
		"archive": "gzip"
	},
	"to": {
		"type": "s3",
		"accessKeyId": "",
		"secretAccessKey": "",
		"region": "eu-central-1",
		"bucket": "",
		"folder": ""
	},
	"hooks": {
		"before": [],
		"done": [],
		"fail": []
	}
};