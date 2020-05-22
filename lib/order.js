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

/// @brief interface an order must implement in order to be used by OrderBook.
/// Note: structly speaking, inheriting from Order should not be required, 
///       due to the template implementation of OrderBook.
var OrderState = require('./types').OrderState;

var last_order_id = 0;

function Order(is_buy, price, qty, filled_qty, filled_cost, order_id, account_, filled_limit) {
    this.state_ = OrderState.os_new;
    this.is_buy_ = is_buy;
    this.price_ = price;
    this.order_qty_ = qty || 0xffffffff;
    this.filled_qty_ = filled_qty || 0;
    this.filled_cost_ = filled_cost || 0;
    this.order_id_ = order_id || last_order_id++;
    this.account_ = account_;
    this.filled_limit_ = filled_limit || 0;
    this.is_filled_limit_ = false;
    this.is_filled_limit_complete_ = true;
    this.filled_remain_ = 0;
    if (filled_limit && filled_limit !== 0){
        this.is_filled_limit_ = true;
        this.is_filled_limit_complete_ = false;
    }
}

Order.prototype.set_filled_limit_complete = function (flag) {
    this.is_filled_limit_complete_ = flag;
};

Order.prototype.is_filled_limit_complete = function () {
    return this.is_filled_limit_complete_;
};

Order.prototype.filled_remain = function () {
    return this.filled_remain_;
};

Order.prototype.is_filled_limit = function () {
    return this.is_filled_limit_;
};

Order.prototype.filled_limit = function () {
    return this.filled_limit_;
};

Order.prototype.set_order_id = function (order_id) {
    this.order_id_ = order_id
};

/// @brief is this a limit order?
Order.set_next_order_id = function (order_id) {
    last_order_id = order_id;
    last_order_id++;
};

/// @brief is this a limit order?
Order.prototype.is_limit = function () {
    return this.price() > 0;
};

/// @brief is this order a buy?
Order.prototype.is_buy = function () {
    return this.is_buy_;
};

/// @brief get the price of this order, or 0 if a market order
Order.prototype.price = function () {
    return this.price_;
};

/// @brief get the quantity of this order
Order.prototype.order_qty = function () {
    return this.order_qty_;
};

/// @brief get the order's state
Order.prototype.state = function () {
    return this.state_;
};

/// @brief get the open quantity of this order
Order.prototype.open_qty = function () {
    // If not completely filled, calculate
    if (this.filled_qty_ < this.order_qty_) {
        return this.order_qty_ - this.filled_qty_;
    } else {
        return 0;
    }
};

/// @brief get the filled quantity of this order
Order.prototype.filled_qty = function () {
    return this.filled_qty_;
};

Order.prototype.filled_cost = function () {
    return this.filled_cost_;
};

/// @brief notify of a fill of this order
/// @param fill_qty the number of shares in this fill
/// @param fill_cost the total amount of this fill
/// @fill_id the unique identifier of this fill
Order.prototype.fill = function (fill_qty, fill_cost, fill_id) {
    this.filled_qty_ += fill_qty;
    this.filled_cost_ += fill_cost;
    if (!this.open_qty()) {
        this.state_ = OrderState.os_complete;
    }
};

/// @brief exchange accepted this order
Order.prototype.accept = function () {
    if (this.state_ === OrderState.os_new) {
        this.state_ = OrderState.os_accepted;
    }
};

/// @brief exchange cancelled this order
Order.prototype.cancel = function () {
    if (this.state_ !== OrderState.os_complete) {
        this.state_ = OrderState.os_cancelled;
    }
};

/// @brief exchange replaced this order
/// @param size_delta change to the order quantity
/// @param new_price the new price
Order.prototype.replace = function (size_delta, new_price) {
    if (this.state_ === OrderState.os_accepted) {
        this.order_qty_ += size_delta;
        this.price_ = new_price;
    }
};

module.exports = Order;
