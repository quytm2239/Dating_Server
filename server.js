// =================================================================
// get the packages we need ========================================
// =================================================================
var express = require('express');
var app = express();

var bodyParser = require('body-parser');
var morgan = require('morgan');
var mysql = require('mysql');
var nodemailer = require('nodemailer');
var passwordHash = require('password-hash');

var jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
var config = require('./config'); // get our config file

// =================================================================
// configuration ===================================================
// =================================================================
var port = 1234;

//------------------------
//-error code definitions-
//------------------------
var code_db_error = 1000;
var code_success = 200;

var code_null_invalid_email 	= 2001;
var code_null_invalid_password 	= 2002;
var code_null_invalid_full_name = 2003;
var code_null_invalid_gender 	= 2004;
var code_null_invalid_avatar 	= 2005;
var code_null_invalid_birthday 	= 2006;
var code_null_invalid_lat_long 	= 2007;
var code_null_invalid_address 	= 2008;

var code_duplicate_email 		= 2009;
var code_duplicate_full_name 	= 2010;
var code_duplicate_nick_name 	= 2011;

var code_wrong_old_password 	= 2012;

var code_not_exist_email 		= 2013;
var code_not_exist_profile 		= 2014;

function errorMessage(code) {
	var mess;
	switch (code) {
	case code_success:
		mess = "Sucessfully!";
		break;
	case code_null_invalid_email:
		mess = "Email is blank or not valid.";
		break;
	case code_null_invalid_password:
		mess = "Password is blank or not valid.";
		break;
	case code_null_invalid_full_name:
		mess = "full_name is blank or not valid.";
		break;
	case code_null_invalid_gender:
		mess = "gender is blank or not valid (number is valid).";
		break;
	case code_null_invalid_avatar:
		mess = "avatar is blank or not valid.";
		break;
	case code_null_invalid_birthday:
		mess = "birthday is blank or not valid. (yyyy-mm-dd)";
		break;
	case code_null_invalid_lat_long:
		mess = "latitude & longitude is blank or not valid.";
		break;
	case code_null_invalid_address:
		mess = "province is blank or not valid.";
		break;

	case code_duplicate_email:
		mess = "email already exist";
		break;
	case code_duplicate_full_name:
		mess = "full_name already exist";
		break;
	case code_duplicate_nick_name:
		mess = "nick_name already exist";
		break;

	case code_wrong_old_password:
		mess = "old_password is wrong";
		break;

	case code_not_exist_email:
		mess = "email does not exist";
		break;
	case code_not_exist_profile:
		mess = "profile does not exist";
		break;
	}
	return mess;
}

app.set('superSecret', config.secret); // secret variable

// use body parser so we can get info from POST and/or URL parameters
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// use morgan to log requests to the console
app.use(morgan('dev'));

/*
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
*/

// =================================================================
// ============================mySql================================
// =================================================================

var pool = mysql.createPool({
    connectionLimit: 5000, //important
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dating',
    debug: false
});

// ---------------------------------------------------------
// Utilities function
// ---------------------------------------------------------

//hashPass('123456');
//hashPass: sha1$214da8ad$1$37aed6a35d09186fb9b2ee75bd6f8559c565a24e

function chkObj(obj) {
	if ((obj === undefined || obj === null) == false) {
		return true;
	}
	return false;
}

function hashPass(orginialPass) {
    return passwordHash.generate(orginialPass);
}

function isExactPass(inputPass,passToCheck) {
    return passwordHash.verify(inputPass, passToCheck);
}

function validateEmail(email) {
    var regex = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return regex.test(email);
}

function validateBirthday(birthDay) {
	var regex = /^[0-9]{4}\-[0-9]{2}\-[0-9]{2}$/;

	if (regex.test(birthDay)) {
		var res = birthDay.split("-");
		var year = res[0];
		var month = res[1];
		var day = res[2];

		if (month < 1 || month > 12 || day <= 0) {
			return false;
		}

		switch (month) {
			case '01': case '03': case '05': case '07':
			case '08': case '10': case '12':
				if (day > 31) return false;
			break;

			case '02':
				if (year%4 == 0 && day > 29)  { return false; }
				if (year%4 != 0 && day > 28)  { return false; }
			break;

			case '04': case '06': case '09': case '11':
				if (day > 30) return false;
			break;
		}
		return true;

	} else {
		return false;
	}
}

function validateCoordinate(latitude,longitude) {
	if (
		(isNaN(latitude) == false || isNaN(longitude) == false)
		&&
		(latitude <= 90.0 && latitude >= -90.0) || (longitude >= 0.0 && longitude <= 360.0)
		) {
		return true;
	}
	return false;
}

function getAge(birthDayStr) {
	var birthDay = new Date(str);
    var diff = new Date().getTime() - birthDay.getTime();
	return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

function sendMailResetPass(emailLogin, resetPass) {
    var transporter = nodemailer.createTransport({
        service: 'Gmail',
        auth: {
            user: 'quytm2239@gmail.com', // Your email id
            pass: 'thucgu239' // Your password
        }
    });

	var text = 'Your new pass of ' + emailLogin + ' is: ' + resetPass;

	var mailOptions = {
		from: 'noreply_dating@gmail.com', // sender address
		to: emailLogin, // list of receivers
		subject: 'Dating Reset password', // Subject line
		text: text
	};

	transporter.sendMail(mailOptions, function(error, info){
		if(error){
			console.log(error);
		}else{
			console.log('Message sent: ' + info.response);
		};
	});
}

// ---------------------------------------------------------
// get an instance of the router for api routes
// ---------------------------------------------------------
var apiRoutes = express.Router();
// ---------------------------------------------------------
// REGISTER (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/register
apiRoutes.post('/register', function(req, res) {

	var email_login 	= req.body.email_login;
	var password 		= req.body.password;
	var full_name 		= req.body.full_name;
	var gender 			= req.body.gender;
	var avatar 			= req.body.avatar;
	var birthday 		= req.body.birthday;
	var province 		= req.body.province;
	var latitude 		= req.body.latitude;
	var longitude 		= req.body.longitude;

	// Validate email_login
	if (!(chkObj(email_login)) || !(validateEmail(email_login)))
	{
		res.json({
			status: code_null_invalid_email,
			message: errorMessage(code_null_invalid_email)
		});
		return;
	}

	// Validate password
	if (!(chkObj(password))) {
		res.json({
			status: code_null_invalid_password,
			message: errorMessage(code_null_invalid_password)
		});
		return;
	}

	// Validate full_name
	if (!(chkObj(full_name))) {
		res.json({
			status: code_null_invalid_full_name,
			message: errorMessage(code_null_invalid_full_name)
		});
		return;
	}

	// Validate avatar
	if (!(chkObj(avatar)))
	{
		res.json({
			status: code_null_invalid_avatar,
			message: errorMessage(code_null_invalid_avatar)
		});
		return;
	}

	// Validate gender
	if (!(chkObj(gender)) || isNaN(gender) || gender < 0 || gender > 5) {
		res.json({
			status: code_null_invalid_gender,
			message: errorMessage(code_null_invalid_gender)
		});
		return;
	}

	// Validate birthday
	if (!(chkObj(birthday)) || !(validateBirthday(birthday)))
	{
		res.json({
			status: code_null_invalid_birthday,
			message: errorMessage(code_null_invalid_birthday)
		});
		return;
	}

	// Validate address
	if (!(chkObj(province)))
	{
		res.json({
			status: code_null_invalid_address,
			message: errorMessage(code_null_invalid_address)
		});
		return;
	}

	// Validate coordinate
	if (!(chkObj(latitude)) || !(chkObj(longitude)) || !(validateCoordinate(latitude,longitude)))
	{
		res.json({
			status: code_null_invalid_lat_long,
			message: errorMessage(code_null_invalid_lat_long)
		});
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.json({
				"status": code_db_error,
				"message": "Error in connection database"
			});
			return;
		}

		/* Begin transaction */
		connection.beginTransaction(function(err) {
			if (err) {
				res.json({
						"status": code_db_error,
						"error" 	: err
					});
				}

			connection.query({
				sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
				timeout: 5000, // 5s
				values: [email_login]
			}, function(error, results, fields) {
				// error -> rollback
				if (error) {
					res.json({
						"status": code_db_error,
						"error" 	: error
					});
					connection.rollback(function() {
						console.log(error);
					});
				}

				if (results == null || results.length == 0)
				{
					//--------------STEP 1: add to table[account]-------------------
					var insertedAccountId;
					connection.query({
						sql: 'INSERT INTO `account`(`email_login`, `full_name`, `password`, `login_status`)'
							+ 'VALUES (?,?,?,?)',
						timeout: 1000, // 1s
						values: [email_login, full_name, hashPass(password), 0]
					}, function (error, results, fields) {

						if (error) {
							console.log('//--------------STEP 1: add to table[account]-------------------');
							res.json({
								"status": code_db_error,
								"error" 	: error
							});
							connection.rollback(function() {
								console.log(error);
							});
						} else {
							insertedAccountId = results.insertId; // store account.account_id is just inserted
					//--------------STEP 2: add to table [address]------------------
							connection.query({
								sql: 'INSERT INTO `address`(`province`, `account_id`)'
								+ ' VALUES (?,?)',
								timeout: 1000, // 1s
								values: [province, insertedAccountId]
							}, function (error, results, fields) {

								if (error) {
									console.log('//--------------STEP 2: add to table [address]------------------');
									res.json({
										"status": code_db_error,
										"error" 	: error
									});
									connection.rollback(function() {
										console.log(error);
									});
								} else {

					//--------------STEP 3: add to table [location]-----------------
									connection.query({
										sql: 'INSERT INTO `location`(`latitude`, `longitude`, `account_id`)'
										+ ' VALUES (?,?,?)',
										timeout: 1000, // 1s
										values: [latitude, longitude, insertedAccountId]
									}, function (error, results, fields) {

										if (error) {
											console.log('//--------------STEP 3: add to table [location]-----------------');
											res.json({
												"status": code_db_error,
												"error" 	: error
											});
											connection.rollback(function() {
												console.log(error);
											});
										} else {

					//--------------STEP 4: add to table [profile]------------------
											connection.query({
												sql: 'INSERT INTO `profile`(`avatar`, `gender`, `account_id`, `birthday`)'
												+ ' VALUES (?,?,?,?)',
												timeout: 1000, // 1s
												values: [avatar, gender, insertedAccountId, birthday]
											}, function (error, results, fields) {

												if (error) {
													console.log('//--------------STEP 4: add to table [profile]------------------');
													res.json({
														"status": code_db_error,
														"error" 	: error
													});
													connection.rollback(function() {
														console.log(error);
													});
												} else {
													connection.commit(function(err) {
														if (err) {
															res.json({
																"status": code_db_error,
																"error" 	: error
															});
															connection.rollback(function() {
																console.log(error);
															});
														}
														console.log('Transaction Complete.');
														res.json({
															status: code_success,
															message: errorMessage(code_success)
														});
														connection.release();
					//--------------REGISTER SUCESSFULLY----------------------------
													});
												}
											});
										}
									});
								}
							});
						}
					});
				}
				else
				{
					connection.release();
					res.json({
						status: code_duplicate_email,
						message: errorMessage(code_duplicate_email)
					});
				}
			});
		});
		/* End transaction */
	});
});

// ---------------------------------------------------------
// LOGIN (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/login
apiRoutes.post('/login', function(req, res) {
	console.log('/login: ' + req.body.email_login);

	var email_login = req.body.email_login;
	var password 	= req.body.password;

	// Validate email_login
	if (!(chkObj(email_login)) || !(validateEmail(email_login)))
	{
		res.json({
			status: code_null_invalid_email,
			message: errorMessage(code_null_invalid_email)
		});
		return;
	}

	// Validate password
	if (!(chkObj(password))) {
		res.json({
			status: code_null_invalid_password,
			message: errorMessage(code_null_invalid_password)
		});
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.json({
				"status": code_db_error,
				"message": "Error in connection database"
			});
			return;
		}
		connection.query({
			sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
			timeout: 2000, // 2s
			values: [email_login]
		}, function(error, results, fields) {
			connection.release();

			if (error) {
				res.json(error);
				return;
			}

			if (results == null || results.length == 0) {
				res.json({
					status: code_not_exist_email,
					message: errorMessage(code_not_exist_email)
				});
			} else {
				// found username -> check if password matches
				if (isExactPass(password,results[0]['password']) == false) {
					res.json({
						status: code_null_invalid_password,
						message: errorMessage(code_null_invalid_password)
					});
				} else { // match -> create token
					var token = jwt.sign(results[0], app.get('superSecret'), {
						expiresIn: 86400 // expires in 24 hours
					});
					res.json({
						status: code_success,
						message: errorMessage(code_success),
						login_account: results[0],
						token: token
					});
				}
			}
		});
	});
});

// ---------------------------------------------------------
// FORGOT (no middleware necessary since this isnt authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/forgot
apiRoutes.post('/forgot', function(req, res) {

	var email_login = req.body.email_login;

	// Validate email_login
	if (!(chkObj(email_login)) || !(validateEmail(email_login)))
	{
		res.json({
			status: code_null_invalid_email,
			message: errorMessage(code_null_invalid_email)
		});
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.json({
				"status": code_db_error,
				"message": "Error in connection database"
			});
			return;
		}

		connection.query({
			sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
			timeout: 1000, // 1s
			values: [req.body.email_login]
		}, function(error, results, fields) {

			if (results == null || results.length == 0) { // email_login not found
				connection.release();
				res.json({
					status: code_not_exist_email,
					message: errorMessage(code_not_exist_email)
				});
			} else { // found -> update new random password
				var randomPassword = Math.random().toString(36).slice(-8);

				connection.query({
					sql: 'UPDATE `account` '
					+ 'SET `password`= ?'
					+ ' WHERE `account_id` = ?',
					timeout: 1000, // 1s
					values: [hashPass(randomPassword), results[0]['account_id']]
				}, function (error, results, fields) {
					connection.release();
					if (error) {
						res.json(error);
					} else {
						sendMailResetPass(email_login,randomPassword);
						res.json({
							status: code_success,
							message: errorMessage(code_success)
						});
					}
				});
			}
		});
	});
});

// ---------------------------------------------------------
// Route middleware to authenticate and check token
// ---------------------------------------------------------
apiRoutes.use(function(req, res, next) {

    // check header or url parameters or post parameters for token
    var token = req.body.token || req.param('token') || req.headers['token'];

    // decode token
    if (token) {

        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function(err, decoded) {
            if (err) {
                return res.json({
                    status: 4031,
                    message: 'Failed to authenticate token.'
                });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {
        return res.status(403).send({
            status: 403,
            message: 'No token provided.'
        });
    }
});

//==============================================================================
//============================Authenticated routes==============================
//==============================================================================

// ---------------------------------------------------------
// CHANGE PASSWORD (this is authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/changePass
apiRoutes.put('/changePass', function(req, res) {

	var old_password = req.body.old_password;
	var new_password = req.body.new_password;

	if (!(chkObj(old_password)) || !(chkObj(new_password))) {
		res.json({
			status: code_null_invalid_password,
			message: errorMessage(code_null_invalid_password)
		});
		return;
	}

	// get account_id from request.token
	var account_id = req.decoded['account_id'];

	pool.getConnection(function(err, connection) {
		if (err) {
			res.json({
				"status": code_db_error,
				"message": "Error in connection database"
			});
			return;
		}
		//------------------------ CHANGE PASSWORD -----------------------------
		connection.query({
			sql: 'SELECT * FROM `account` WHERE `account_id` = ?',
			timeout: 1000, // 1s
			values: [account_id]
		}, function(error, results, fields) {
			if (isExactPass(old_password,results[0]['password']) == false) { // old_password does not match
				connection.release();
				res.json({
					status: code_wrong_old_password,
					message: errorMessage(code_wrong_old_password)
				});
			} else { // Old_password matched -> update new pass
				connection.query({
					sql: 'UPDATE `account` '
					+ 'SET `password`= ?'
					+ ' WHERE `account_id` = ?',
					timeout: 1000, // 1s
					values: [hashPass(new_password), account_id]
				}, function (error, results, fields) {
					connection.release();
					if (error) {
						res.json(error);
					} else {
						res.json({
							status: code_success,
							message: errorMessage(code_success)
						});
					}
				});
			}
		});
	});
});

// ---------------------------------------------------------
// PROFILE (this is authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/profile
apiRoutes.get('/profile', function(req, res) {

	// check header or url parameters or post parameters for token
	var profile_id = req.body.profile_id || req.param('profile_id') || req.headers['profile_id'];

	if (chkObj(profile_id)) {
		var profile_id = req.decoded['profile_id'];
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.json({
				"status": code_db_error,
				"message": "Error in connection database"
			});
			return;
		}
		connection.query({
			sql: 'SELECT * FROM `profile` WHERE `profile_id` = ?',
			timeout: 1000, // 1s
			values: [profile_id]
		}, function(error, results, fields) {
			connection.release();
			if (results.length == 0 || results == null) {
				res.json({
					status : code_not_exist_profile,
					message : errorMessage(code_not_exist_profile)
				});
			} else {
				res.json(results[0]);
			}
		});
	});
});

app.use('/api', apiRoutes);

// =================================================================
// start the server ================================================
// =================================================================
app.listen(port);
console.log('Server is running... at http://localhost:' + port);