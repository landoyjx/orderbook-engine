/*
 * @version 1.0.0
 * Copyright (C) 2017 by landoyjx.
 * or its affiliates. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License").
 * You may not use this file except in compliance with
 * the License. A copy of the License is located at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

/**
 * Self defined sorted multimap,
 * use internal, not for public
 * @type {sort|exports}
 */
var sortObj = require('sort-object');
var List = require('collections/list');
var _ = require('lodash');

/**
 * Iterator of multimap
 * reverse is only key reversed, not value
 * @param col
 * @param reverse
 * @param main, index from col_[], by reverse
 * @param sub, index from col_[][], not reverse
 * @constructor
 */
function Iterator(col, reverse, main, sub) {
	this.col_ = col;
	this.reverse_ = reverse ? reverse : false;
	this.index_main_ = main ? main : 0;
	this.index_sub_ = sub ? sub : 0;
}

/**
 * Check if it's end of multimap
 * @returns {boolean}
 */
Iterator.prototype.is_end = function() {
	var keys = Object.keys(this.col_);
	return this.index_main_ === keys.length;
};

/**
 * Not end checking
 * @returns {boolean}
 */
Iterator.prototype.is_not_end = function() {
	return !this.is_end();
};

/**
 * Get the key of current iterator for multimap
 * @returns {*}
 */
Iterator.prototype.first = function() {
	var keys = Object.keys(this.col_);
	if (this.reverse_) {
		return keys[keys.length - this.index_main_ - 1];
	} else {
		return keys[this.index_main_];
	}
};

/**
 * Get the value of current iterator for multimap
 * @returns {*}
 */
Iterator.prototype.second = function() {
	var key = this.first();
	var obj = this.col_;
	var array = obj[key].toArray();
	return array[this.index_sub_];
};

/**
 * Move to next element of iterator
 * The reserved flag is only applied to main index
 */
Iterator.prototype.next = function() {
	this.index_sub_++;
	var key = this.first();
	var obj = this.col_;
	var array_len = obj[key].length;
	if (this.index_sub_ === array_len) {
		this.index_sub_ = 0;
		this.index_main_++;
	}
};

/**
 * Sorted-MultiMap
 * @param reverse
 * @constructor
 */
function MultiMap(reverse) {
	this.obj_ = {};
	this.reverse_ = reverse ? reverse : false;
}

/**
 * Add one element to multimap
 * @param key
 * @param value
 */
MultiMap.prototype.insert = function(key, value) {
	if (this.obj_[key]) {
		this.obj_[key].push(value);
	} else {
		var __value = new List([]);
		__value.push(value);
		var item = {};
		item[key] = __value;
		this.obj_ = sortObj(_.extend(this.obj_, item));
	}
};

/**
 * Find the iterator of the key firstly,
 * otherwise return end iterator
 * @param key
 */
MultiMap.prototype.find = function(key) {
	var keys = Object.keys(this.obj_);
	var index = keys.indexOf(String(key));
	// process
	if (index === -1) {
		return new Iterator(this.obj_, this.reverse_, keys.length);
	}

	if (this.reverse_) {
		return new Iterator(this.obj_, this.reverse_, keys.length - index -1);
	} else {
		return new Iterator(this.obj_, this.reverse_, index);
	}
};

/**
 * Remove the element pointed by it
 * After erase, next should not move when iterating
 * @param it
 */
MultiMap.prototype.erase = function(it) {
	var key = it.first();
	var list = this.obj_[key];
	var array = list.toArray();
	var sub_item = array[it.index_sub_];
	list.delete(sub_item);
	// If none elements, delete it
	if (list.length === 0) {
		delete this.obj_[key];
	}
};

/**
 * Get the begin iterator of multimap
 * @returns {Iterator}
 */
MultiMap.prototype.begin = function() {
	return new Iterator(this.obj_, this.reverse_);
};

/**
 * return aggregate data
 * @returns {Array}
 */
MultiMap.prototype.data = function() {
	var keys = Object.keys(this.obj_);
	if (this.reverse_) {
		keys = keys.reverse();
	}
	var result = [];
	for (var i in keys) {
		var key = keys[i];
		var list = this.obj_[key].toArray();
		var amount = 0;
		for (var j in list) {
			var item = list[j];
			amount += item.open_qty();
		}
		result.push({price: key, amount: amount});
	}
	return result;
};

/**
 * Only for debug, should not used in production
 * @returns {{}}
 */
MultiMap.prototype.print = function() {
	var it = this.begin();
	while (it.is_not_end()) {
		console.log(it.first() + '->' + JSON.stringify(it.second()));
		it.next();
	}
};

module.exports = MultiMap;
