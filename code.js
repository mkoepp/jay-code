var gulp = require("gulp");
var jscs = require("gulp-jscs");
var jshint = require("gulp-jshint");

var filesToLint = [
	"app/**/*.js",

	// Exclude libraries, node modules, and NativeScript modules from linting
	"!app/lib/**/*.js",
	"!app/node_modules/**/*.js",
	"!app/tns_modules/**/*.js"
];

gulp.task("jscs", function() {
	gulp.src(filesToLint)
		.pipe(jscs());
});

gulp.task("jshint", function() {
	return gulp.src(filesToLint)
		.pipe(jshint())
		.pipe(jshint.reporter());
});

gulp.task("lint", ["jshint", "jscs"]);

var applicationModule = require("application");
var navigation = require("./shared/navigation");

applicationModule.mainModule = navigation.startingPage();
applicationModule.start();

var frameModule = require("ui/frame");

exports.styleActionBar = function() {
	var topmost = frameModule.topmost();
	if (topmost.ios) {
		// Make the iOS status bar use white text
		var navigationBar = topmost.ios.controller.navigationBar;
		navigationBar.barStyle = 1;
	}
};
var gesturesModule = require("ui/gestures");

exports.hideKeyboardOnBlur = function(page, views) {
	page.observe(gesturesModule.GestureTypes.tap, function() {
		views.forEach(function(view) {
			view.dismissSoftInput();
		});
	});
};

var config = require("../../shared/config");
var Observable = require("data/observable").Observable;
var validator = require("email-validator");

function User(info) {
	info = info || {};

	// You can add properties to observables on creation
	var viewModel = new Observable({
		email: info.email || "",
		password: info.password || ""
	});

	viewModel.login = function() {
		return fetch(config.apiUrl + "oauth/token", {
			method: "POST",
			body: JSON.stringify({
				username: viewModel.get("email"),
				password: viewModel.get("password"),
				grant_type: "password"
			}),
			headers: {
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors)
		.then(function(response) {
			return response.json();
		}).then(function(data) {
			config.token = data.Result.access_token;
		});
	};

	viewModel.register = function() {
		return fetch(config.apiUrl + "Users", {
			method: "POST",
			body: JSON.stringify({
				Username: viewModel.get("email"),
				Email: viewModel.get("email"),
				Password: viewModel.get("password")
			}),
			headers: {
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors);
	};

	viewModel.resetPassword = function() {
		return fetch(config.apiUrl + "Users/resetpassword", {
			method: "POST",
			body: JSON.stringify({
				Email: viewModel.get("email"),
			}),
			headers: {
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors);
	};

	viewModel.isValidEmail = function() {
		var email = this.get("email");
		return validator.validate(email);
	};

	return viewModel;
}

function handleErrors(response) {
	if (!response.ok) {
		console.log(JSON.stringify(response));
		throw Error(response.statusText);
	}
	return response;
}

module.exports = User;

var config = require("../../shared/config");
var ObservableArray = require("data/observable-array").ObservableArray;
var navigation = require("../navigation");

function indexOf(item) {
	var match = -1;
	this.forEach(function(loopItem, index) {
		if (loopItem.id === item.id) {
			match = index;
		}
	});
	return match;
}

function GroceryListViewModel(items) {
	var viewModel = new ObservableArray(items);
	var history = new ObservableArray([]);

	viewModel.indexOf = indexOf;
	history.indexOf = indexOf;

	viewModel.load = function() {
		return fetch(config.apiUrl + "Groceries", {
			headers: {
				"Authorization": "Bearer " + config.token
			}
		})
		.then(handleErrors)
		.then(function(response) {
			return response.json();
		}).then(function(data) {
			viewModel.empty();
			data.Result.forEach(function(grocery) {
				var destination = grocery.Deleted ? history : viewModel;
				destination.push({
					name: grocery.Name,
					id: grocery.Id,
					deleted: grocery.Deleted,
					done: destination === history ? false : (grocery.Done || false)
				});
			});
		});
	};

	viewModel.empty = function() {
		while (viewModel.length) {
			viewModel.pop();
		}
		while (history.length) {
			history.pop();
		}
	};

	viewModel.history = function() {
		return history;
	};
	viewModel.toggleDoneHistory = function(index) {
		var item = history.getItem(index);
		history.setItem(index, {
			name: item.name,
			id: item.id,
			deleted: true,
			done: !item.done
		});
	};

	viewModel.add = function(grocery) {
		return fetch(config.apiUrl + "Groceries", {
			method: "POST",
			body: JSON.stringify({
				Name: grocery
			}),
			headers: {
				"Authorization": "Bearer " + config.token,
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors)
		.then(function(response) {
			return response.json();
		})
		.then(function(data) {
			viewModel.push({ name: grocery, id: data.Result.Id });
		});
	};

	viewModel.restore = function() {
		var indeces = [];
		var matches = [];
		history.forEach(function(item) {
			if (item.deleted && item.done) {
				indeces.push(item.id);
				matches.push(item);
			}
		});

		return fetch(config.apiUrl + "Groceries", {
			method: "PUT",
			body: JSON.stringify({
				Deleted: false,
				Done: false
			}),
			headers: {
				"Authorization": "Bearer " + config.token,
				"Content-Type": "application/json",
				"X-Everlive-Filter": JSON.stringify({
					"Id": {
						"$in": indeces
					}
				})
			}
		})
		.then(handleErrors)
		.then(function() {
			matches.forEach(function(match) {
				var index = history.indexOf(match);
				match.deleted = false;
				match.done = false;
				history.splice(index, 1);
				viewModel.push(match);
			});
		});
	};

	viewModel.delete = function(index) {
		var item = viewModel.getItem(index);
		viewModel.splice(index, 1);
		item.done = false;
		item.deleted = true;
		history.push(item);

		return fetch(config.apiUrl + "Groceries/" + item.id, {
			method: "PUT",
			body: JSON.stringify({
				Deleted: true
			}),
			headers: {
				"Authorization": "Bearer " + config.token,
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors);
	};

	viewModel.toggleDone = function(index) {
		var item = viewModel.getItem(index);
		item.done = !item.done;
		viewModel.setItem(index, item);

		return fetch(config.apiUrl + "Groceries/" + item.id, {
			method: "PUT",
			body: JSON.stringify({
				Done: item.done
			}),
			headers: {
				"Authorization": "Bearer " + config.token,
				"Content-Type": "application/json"
			}
		})
		.then(handleErrors);
	};

	return viewModel;
}

function handleErrors(response) {
	if (!response.ok) {
		console.log(JSON.stringify(response));

		if (response.status === 403) {
			navigation.signOut();
		}

		throw Error(response.statusText);
	}
	return response;
}

module.exports = GroceryListViewModel;
