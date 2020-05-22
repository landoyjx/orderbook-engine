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

var OrderCondition = require('./types').OrderCondition;

/// @brief construct
function OrderTracker(order, conditions) {
	this.order_ = order;
	this.open_qty_ = order.open_qty();
	if (!conditions) {
		conditions = 0;
	}
	this.conditions_ = conditions;
	this.filled_cost_ = order.filled_cost();
	this.filled_remain_ = order.filled_remain();
}

/// @brief modify the order quantity
OrderTracker.prototype.change_qty = function(delta) {
	if ((delta < 0 && this.open_qty_ < Math.abs(delta))) {
		throw new Error('Replace size reduction larger than open quantity');
	}
	this.open_qty_ += delta;
};

/// @brief fill an order
/// @param qty the number of shares filled in this fill
OrderTracker.prototype.fill = function(qty, price) {
	if (qty > this.open_qty_) {
		throw new Error('Fill size larger than open quantity');
	}

	this.filled_cost_ += qty * price;
	if (this.order_.is_filled_limit() === true){
		this.filled_remain_ = (this.order_.filled_limit() - this.filled_cost_).toFixed(2);
	}
	this.open_qty_ -= qty;
};

/// @brief is there no remaining open quantity in this order?
OrderTracker.prototype.filled = function() {
	return this.open_qty_ === 0;
};

/// @brief get the total filled quantity of this order
OrderTracker.prototype.filled_qty = function() {
	return (this.order_.order_qty() - this.open_qty()).toFixed(2);
};

/// @brief get the open quantity of this order
OrderTracker.prototype.open_qty = function() {
	return this.open_qty_;
};

/// @brief get the order pointer
OrderTracker.prototype.ptr = function() {
	this.order_.open_qty_ = this.open_qty_;
	this.order_.filled_cost_ = this.filled_cost_;
	this.order_.filled_remain_ = this.filled_remain_;
	return this.order_;
};

/// @ brief is this order marked all or none?
OrderTracker.prototype.all_or_none = function() {
	return this.conditions_ & OrderCondition.oc_all_or_none;
};

/// @ brief is this order marked immediate or cancel?
OrderTracker.prototype.immediate_or_cancel = function() {
	return this.conditions_ &  OrderCondition.oc_immediate_or_cancel;
};

module.exports = OrderTracker;
