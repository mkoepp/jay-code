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