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

var code_null_invalid_email	= 2001;
var code_null_invalid_password	= 2002;
var code_null_invalid_full_name	= 2003;
var code_null_invalid_user_status	= 2004;
var code_null_invalid_gender	= 2005;
var code_null_invalid_avatar	= 2006;
var code_null_invalid_birthday	= 2007;
var code_null_invalid_lat_long	= 2008;
var code_null_invalid_address	= 2009;
var code_null_invalid_phone	= 2010;
var code_null_invalid_profile_description	= 2011;

var code_duplicate_email_login	= 2012;
var code_duplicate_full_name	= 2013;

var code_wrong_old_password	= 2014;

var code_not_exist_email	= 2015;
var code_not_exist_profile	= 2016;
var code_not_exist_status	= 2017;

var code_not_match_password	= 2018;

var code_null_invalid_page_size	= 2019;
var code_null_invalid_page	= 2020;

function errorMessage(code) {
	var mess;
	switch (code) {
	case code_success:
		mess = "Sucessfully!";
		break;
	case code_null_invalid_email:
		mess = "Email is blank/null or not valid.";
		break;
	case code_null_invalid_password:
		mess = "Password is blank/null or not valid.";
		break;
	case code_null_invalid_full_name:
		mess = "full_name is blank/null or not valid.";
		break;
	case code_null_invalid_user_status:
		mess = "user_status is blank/null or not valid.";
		break;
	case code_null_invalid_gender:
		mess = "gender is blank or not valid (number is valid).";
		break;
	case code_null_invalid_avatar:
		mess = "avatar is blank/null or not valid.";
		break;
	case code_null_invalid_birthday:
		mess = "birthday is blank/null or not valid. (yyyy-mm-dd)";
		break;
	case code_null_invalid_lat_long:
		mess = "latitude & longitude is blank/null or not valid.";
		break;
	case code_null_invalid_address:
		mess = "province is blank/null or not valid.";
		break;
	case code_null_invalid_phone:
		mess = "phone is blank/null or not valid.";
		break;
	case code_null_invalid_profile_description:
		mess = "profile_description is blank/null or not valid.";
		break;

	case code_duplicate_email_login:
		mess = "email_login already exist";
		break;
	case code_duplicate_full_name:
		mess = "full_name already exist";
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
	case code_not_exist_status:
		mess = "status does not exist";
		break;
	case code_not_match_password:
		mess = "password does not match/wrong password";
		break;

	case code_null_invalid_page_size:
		mess = "page_size is blank/null or not valid. (number required)";
		break;
	case code_null_invalid_page:
		mess = "page is blank/null or not valid. (number required)";
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
    connectionLimit: 10000, //important
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dating',
    debug: false
});

// ---------------------------------------------------------
// Utilities function
// ---------------------------------------------------------

function getDistance(lat1,lon1,lat2,lon2) {
  var R = 6371; // Radius of the earth in km (mean radius)
  var dLat = deg2rad(lat2-lat1);  // deg2rad below
  var dLon = deg2rad(lon2-lon1);
  var a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ;
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  var d = R * c; // Distance in km
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180)
}
//-----------------------------------------------------

function responseConvention(code,data) {
	var JSONobj = {
		status: code,
		message: errorMessage(code),
		data: data
	};
	return JSONobj
}

function responseWithMessage(code,message,data) {
	var JSONobj = {
		status: code,
		message: message,
		data: data
	};
	return JSONobj
}

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

function validatePhone(phone) {
	var regex = /^[0-9]{10,11}$/;
	return regex.test(phone);
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

// =============================================================================
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
	var birthday 		= req.body.birthday;
	var province 		= req.body.province;
	var latitude 		= req.body.latitude;
	var longitude 		= req.body.longitude;

	// Validate email_login
	if (!(chkObj(email_login)) || !(validateEmail(email_login)))
	{
		res.status(400).send(responseConvention(code_null_invalid_email,[]));
		return;
	}

	// Validate password
	if (!(chkObj(password))) {
		res.status(400).send(responseConvention(code_null_invalid_password,[]));
		return;
	}

	// Validate full_name
	if (!(chkObj(full_name))) {
		res.status(400).send(responseConvention(code_null_invalid_full_name,[]));
		return;
	}

	// Validate gender
	if (!(chkObj(gender)) || isNaN(gender) || gender < 0 || gender > 5) {
		res.status(400).send(responseConvention(code_null_invalid_gender,[]));
		return;
	}

	// Validate birthday
	if (!(chkObj(birthday)) || !(validateBirthday(birthday)))
	{
		res.status(400).send(responseConvention(code_null_invalid_birthday,[]));
		return;
	}

	// Validate address
	if (!(chkObj(province)))
	{
		res.status(400).send(responseConvention(code_null_invalid_address,[]));
		return;
	}

	// Validate coordinate
	if (!(chkObj(latitude)) || !(chkObj(longitude)) || !(validateCoordinate(latitude,longitude)))
	{
		res.status(400).send(responseConvention(code_null_invalid_lat_long,[]));
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,'Error in DB connection',[]));
			return;
		}

		// CHECK [email_login] if Duplicate or NOT Duplicate
		connection.query({
			sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
			timeout: 5000, // 5s
			values: [email_login]
		}, function(error, results, fields) {
			// error -> rollback
			if (error) {
				res.status(500).send(responseWithMessage(code_db_error,error,[]));
				connection.rollback(function() {
					console.log(error);
				});
				connection.release();
				return;
			}

			if (chkObj(results) && results.length > 0) { // [email_login] is Duplicate
				res.status(400).send(responseConvention(code_duplicate_email_login,[]));
				connection.release();
				return;
			}

			// CHECK [full_name] if Duplicate or NOT Duplicate
			connection.query({
				sql: 'SELECT * FROM `account` WHERE `full_name` = ?',
				timeout: 5000, // 5s
				values: [full_name]
			}, function(error, results, fields) {
				// error -> rollback
				if (error) {
					res.status(500).send(responseWithMessage(code_db_error,error,[]));
					connection.rollback(function() {
						console.log(error);
					});
					connection.release();
					return;
				}

				if (chkObj(results) && results.length > 0) { // [full_name] is Duplicate
					res.status(400).send(responseConvention(code_duplicate_full_name,[]));
					connection.release();
					return;
				}

				/* PASS CHECKING -> INSERT TO DB */
				/* Begin transaction */
				console.log('Transaction Start!');
				connection.beginTransaction(function(err) {
					if (err)
					{
						res.status(500).send(responseWithMessage(code_db_error,err,[]));
						connection.release();
						return;
					}

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
							res.status(500).send(responseWithMessage(code_db_error,error,[]));
							connection.rollback(function() {
								console.log(error);
							});
							connection.release();
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
									res.status(500).send(responseWithMessage(code_db_error,error,[]));
									connection.rollback(function() {
										console.log(error);
									});
									connection.release();
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
											res.status(500).send(responseWithMessage(code_db_error,error,[]));
											connection.rollback(function() {
												console.log(error);
											});
											connection.release();
										} else {

					//--------------STEP 4: add to table [profile]------------------
											connection.query({
												sql: 'INSERT INTO `profile`(`gender`,`account_id`,`birthday`)'
												+ ' VALUES (?,?,?)',
												timeout: 1000, // 1s
												values: [gender, insertedAccountId, birthday]
											}, function (error, results, fields) {

												if (error) {
													console.log('//--------------STEP 4: add to table [profile]------------------');
													res.status(500).send(responseWithMessage(code_db_error,error,[]));
													connection.rollback(function() {
														console.log(error);
													});
													connection.release();
												} else {
													connection.commit(function(err) {
														if (err)
														{
															console.log('Transaction Failed.');
															res.status(500).send(responseWithMessage(code_db_error,err,[]));
															connection.rollback(function() {
																console.log(error);
															});
														}
														else
														{
															console.log('Transaction Complete.');
															res.status(200).send(responseConvention(code_success,[]));
															connection.release();
														}
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
				});
				/* End transaction */
			});
		});
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
		res.status(400).send(responseConvention(code_null_invalid_email,[]));
		return;
	}

	// Validate password
	if (!(chkObj(password))) {
		res.status(400).send(responseConvention(code_null_invalid_password,[]));
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,"Error in connection database",[]));
			return;
		}
		connection.query({
			sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
			timeout: 2000, // 2s
			values: [email_login]
		}, function(error, results, fields) {
			connection.release();

			if (error) {
				res.status(500).send(responseWithMessage(code_db_error,error,[]));
				return;
			}

			if (results == null || results.length == 0) {
				res.status(400).send(responseConvention(code_not_exist_email,[]));
			} else {
				// found username -> check if password matches
				if (isExactPass(password,results[0]['password']) == false) {
					res.status(400).send(responseConvention(code_not_match_password,[]));
				} else { // match -> create token
					var token = jwt.sign(results[0], app.get('superSecret'), {
						expiresIn: 86400 // expires in 24 hours
					});
					res.json({
						status: code_success,
						message: errorMessage(code_success),
						data: results,
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
		res.status(400).send(responseConvention(code_null_invalid_email,[]));
		return;
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(400).send(responseConvention(code_null_invalid_email,'Error in connection database',[]));
			return;
		}

		connection.query({
			sql: 'SELECT * FROM `account` WHERE `email_login` = ?',
			timeout: 1000, // 1s
			values: [email_login]
		}, function(error, results, fields) {

			if (results == null || results.length == 0) { // email_login not found
				connection.release();
				res.status(400).send(responseConvention(code_not_exist_email,[]));
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
						res.status(500).send(responseWithMessage(code_db_error,error,[]));
					} else {
						sendMailResetPass(email_login,randomPassword);
						res.status(200).send(responseConvention(code_success,[]));
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
                return res.status(400).send({
                    status: 4031,
                    message: 'Failed to authenticate token.',
					data: []
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
            message: 'No token provided.',
			data: []
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
		res.status(400).send(responseConvention(code_null_invalid_password,[]));
		return;
	}

	// get account_id from request.token
	var account_id = req.decoded['account_id'];

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,'Error in connection database',[]));
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
				res.status(400).send(responseConvention(code_wrong_old_password,[]));
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
						res.status(500).send(responseWithMessage(code_db_error,error,[]));
					} else {
						res.status(200).send(responseConvention(code_success,[]));
					}
				});
			}
		});
	});
});

// ---------------------------------------------------------
// GET PROFILE (this is authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/profile
apiRoutes.get('/profile', function(req, res) {

	// check header or url parameters or post parameters for token
	var profile_id = req.body.profile_id || req.param('profile_id') || req.headers['profile_id'];
	var account_id = req.decoded['account_id'];
	var sqlQuery = '';

	if (chkObj(profile_id)) { // contain profile_id in request
		sqlQuery = 'SELECT * FROM `profile` WHERE `profile_id` = ?';
	} else {
		sqlQuery = 'SELECT * FROM `profile` WHERE `account_id` = ?';
	}

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,'Error in connection database',[]));
			return;
		}
		connection.query({
			sql: sqlQuery,
			timeout: 1000, // 1s
			values: [chkObj(profile_id) ? profile_id : account_id]
		}, function(error, results, fields) {
			connection.release();
			if (results.length == 0 || results == null) { // not found record
				res.status(400).send(responseConvention(code_not_exist_profile,[]));
			} else { // found record
				res.status(200).send(responseConvention(code_success,results));
			}
		});
	});
});

// ---------------------------------------------------------
// UPDATE PROFILE (this is authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/profile
apiRoutes.put('/profile', function(req, res) {

	var user_status 		= req.body.user_status;
	var avatar 				= req.body.avatar;
	var gender 				= req.body.gender;
	var birthday 			= req.body.birthday;
	var phone 				= req.body.phone;
	var profile_description = req.body.profile_description;

	if (
		!(chkObj(user_status)) && !(chkObj(avatar)) && !(chkObj(gender))
		 && !(chkObj(birthday)) && !(chkObj(phone)) && !(chkObj(profile_description))
		)
	{
		console.log('User does not modify profile, no query!');
		res.status(200).send(responseConvention(code_success,[]));
		return;
	}

	// STEP 1: Validate status
	if (chkObj(user_status) && user_status == '')
	{
		res.status(400).send(responseConvention(code_null_invalid_user_status,[]));
		return;
	}

	// STEP 2: Validate avatar
	if (chkObj(avatar) && avatar == '')
	{
		res.status(400).send(responseConvention(code_null_invalid_avatar,[]));
		return;
	}

	// STEP 3: Validate gender
	if (chkObj(gender) && gender == '')
	{
		res.status(400).send(responseConvention(code_null_invalid_gender,[]));
		return;
	}

	// STEP 4: Validate birthday
	if (chkObj(birthday) && (birthday == '' || validateBirthday(birthday) == false))
	{
		res.status(400).send(responseConvention(code_null_invalid_birthday,[]));
		return;
	}

	// STEP 5: Validate phone
	if (chkObj(phone) && (phone == '' || validatePhone(phone) == false))
	{
		res.status(400).send(responseConvention(code_null_invalid_phone,[]));
		return;
	}

	// STEP 6: Validate profile_description
	if (chkObj(profile_description) && profile_description == '')
	{
		res.status(400).send(responseConvention(code_null_invalid_profile_description,[]));
		return;
	}

	// get account_id from request.token
	var account_id = req.decoded['account_id'];

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,'Error in connection database',[]));
			return;
		}

		//------------------------- UPDATE PROFILE -----------------------------
		connection.query({
			sql: 'SELECT * FROM `profile` WHERE `account_id` = ?',
			timeout: 1000, // 1s
			values: [account_id]
		}, function(error, results, fields) {
			if (error) {
				connection.release();
				res.status(500).send(responseWithMessage(code_db_error,error,[]));
			} else {
				connection.query({
					sql: 'UPDATE `profile` SET '
					+ '`user_status`= ?,`avatar`= ?,`gender`= ?,`birthday`= ?,'
					+ '`phone`= ?,`profile_description`= ?'
					+ ' WHERE `account_id` = ?',
					timeout: 1000, // 1s
					values:
					[
						chkObj(user_status) ? user_status 					: results[0]['user_status'],
						chkObj(avatar) ? avatar 							: results[0]['avatar'],
						chkObj(gender) ? gender 							: results[0]['gender'],
						chkObj(birthday) ? birthday 						: results[0]['birthday'],
						chkObj(phone) ? phone 								: results[0]['phone'],
						chkObj(profile_description) ? profile_description 	: results[0]['profile_description'],
					 	account_id
					]
				}, function (error, results, fields) {
					connection.release();
					if (error) {
						res.status(500).send(responseWithMessage(code_db_error,error,[]));
					} else {
						res.status(200).send(responseConvention(code_success,[]));
					}
				});
			}
		});
	});
});

// ---------------------------------------------------------
// AROUND PROFILE (this is authenticated)
// ---------------------------------------------------------

// http://localhost:1234/api/aroundProfile
apiRoutes.get('/aroundProfile', function(req, res) {

	var latitude = req.body.latitude || req.param('latitude') || req.headers['latitude'];
	var longitude = req.body.longitude || req.param('longitude') || req.headers['longitude'];
	var page_size = req.body.page_size || req.param('page_size') || req.headers['page_size'];
	var page = req.body.page || req.param('page') || req.headers['page'];

	if ( !(chkObj(latitude)) || !(chkObj(longitude )) )
	{
		res.status(400).send(responseConvention(code_null_invalid_lat_long,[]));
		return;
	}

	if (!(chkObj(page_size)) || isNaN(page_size))
	{
		res.status(400).send(responseConvention(code_null_invalid_page_size,[]));
		return;
	}

	if (!(chkObj(page)) || isNaN(page))
	{
		res.status(400).send(responseConvention(code_null_invalid_page,[]));
		return;
	}

	var limit = page_size;
	var offset = (page - 1) * page_size;

	var distanceStr = '111.1111 * DEGREES(ACOS(COS(RADIANS(l.latitude))'
	+ ' * COS(RADIANS(' + latitude + '))'
	+ ' * COS(RADIANS(l.longitude - ' + longitude + ')) + SIN(RADIANS(l.latitude))'
	+ ' * SIN(RADIANS(' + latitude + '))))';

	var sqlQuery = 'SELECT p.profile_id, a.full_name, p.`user_status`, p.`avatar`,p.`gender`,'
	+ 'p.`account_id`,p.`birthday`,p.`phone`,p.`profile_description`,'
	+ 'p.`created_by`,p.`modified_by`,l.latitude,l.longitude,'
	+ distanceStr + 'AS distance'
	+ ' FROM `profile` p INNER JOIN `location` l ON p.account_id = l.account_id'
	+ ' INNER JOIN `account` a ON p.account_id = a.account_id'
	+ ' WHERE ' + distanceStr + ' <= 10'
	+ ' ORDER BY distance ASC'
	+ ' LIMIT ' + limit + ' OFFSET ' + offset;

	pool.getConnection(function(err, connection) {
		if (err) {
			res.status(500).send(responseWithMessage(code_db_error,'Error in connection database',[]));
			return;
		}
		connection.query({
			sql: sqlQuery,
			timeout: 10000, // 10s
			values: []
		}, function(error, results, fields) {
			connection.release();
			if (results.length == 0 || results == null) {
				res.status(204).send(responseConvention(code_success,[]));
			} else {
				res.status(200).send(responseConvention(code_success,results));
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
