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
var util = require('util');
var List = require('collections/list');
var Iterator = require('collections/iterator');
var Event = require('events').EventEmitter;
var Order = require('./order');
var OrderTracker = require('./ordertracker');
var FillFlags = require('./types').FillFlags;
var OrderPrice = require('./types').OrderPrice;
var OrderEvent = require('./types').OrderEvent;
var MultiMap = require('./multimap');

/// @brief construct
function OrderBook() {
	Event.call(this);

	this.trans_id_ = 0;
	this.bids_ = new MultiMap(true); // reverse
	this.asks_ = new MultiMap();
	this.deferred_bid_crosses_ = new List();
	this.deferred_ask_crosses_ = new List();
}
util.inherits(OrderBook, Event);

OrderBook.prototype.set_next_trans_id = function (trans_id) {
	this.trans_id_ = trans_id;
	//this.trans_id_++;
};
/// @brief add an order to book
/// @param order the order to add
/// @param conditions special conditions on the order
/// @return true if the add resulted in a fill
OrderBook.prototype.add = function(order, conditions, callback) {
	var self = this;
	// Increment transaction ID
	self.trans_id_++;
	var matched = false;
	var err = null;
	var matched_qty = 0;
	var action = '';
	if (!callback) callback = function() {};

	// If the order is invalid, exit
	if (!self._is_valid(order, conditions)) {
		// reject created by is_valid
		err = 'invalid order';
	} else {
		action = 'add';
		var order_price = self._sort_price(order);
		var inbound = new OrderTracker(order, conditions);
		matched = self._add_order(inbound, order_price);
		if (matched) {
			// The filled qty
			action = 'accept';
			matched_qty = inbound.filled_qty();
			self.emit(OrderEvent.accept, {
				trans_id: self.trans_id_,
				order: order,
				matched_qty: matched_qty,
				filled_remain: order.filled_remain(),
				filled_cost: order.filled_cost()
			});
		}
		// Cancel any unfilled IOC order
		if (inbound.immediate_or_cancel() && !inbound.filled()) {
			action = 'cancel';
			self.emit(OrderEvent.cancel, {
				trans_id: self.trans_id_,
				order: order,
				open_qty: 0
			});
		}
		self.emit(OrderEvent.book_update, self.trans_id_);
	}
	callback(err, {
		trans_id: self.trans_id_,
		action: action,
		matched: matched,
		matched_qty: matched_qty,
		order_id: order.order_id_,
		filled_remain: order.filled_remain(),
		filled_cost: order.filled_cost()
	});
};

/// @brief cancel an order in the book
OrderBook.prototype.cancel = function(order, callback) {
	var self = this;
	// Increment transaction ID
	self.trans_id_++;
	if (!callback) callback = function() {};

	var found = false;
	var open_qty;
	// If the cancel is a buy order
	if (order.is_buy()) {
		var bid = self._find_bid(order);
		if (bid.is_not_end()) {
			open_qty = bid.second().open_qty();
			// Remove from container for cancel
			self.bids_.erase(bid);
			found = true;
		}
		// Else the cancel is a sell order
	} else {
		var ask = self._find_ask(order);
		if (ask.is_not_end()) {
			open_qty = ask.second().open_qty();
			self.asks_.erase(ask);
			found = true;
		}
	}

	// If the cancel was found, issue callback
	if (found) {
		callback(null, {
			trans_id: self.trans_id_,
			open_qty: open_qty
		});
		self.emit(OrderEvent.cancel, {trans_id: self.trans_id_, order: order, open_qty: open_qty});
		self.emit(OrderEvent.book_update, self.trans_id_);
	} else {
		callback('order not found');
	}
};

/// @brief replace an order in the book
/// @param order the order to replace
/// @param size_delta the change in size for the order (positive or negative)
/// @param new_price the new order price, or PRICE_UNCHANGED
/// @return true if the replace resulted in a fill
OrderBook.prototype.replace = function(order, size_delta, new_price, callback) {
	var self = this;
	// Increment transaction ID
	self.trans_id_++;
	if (!callback) callback = function() {};

	var matched = false;
	var found = false;
	var price_change = new_price && (new_price !== order.price());
	var price = (new_price === OrderPrice.PRICE_UNCHANGED) ? order.price() : new_price;
	var action = null;

	// If the order to replace is a buy order
	if (order.is_buy()) {
		var bid = self._find_bid(order);
		// If the order was found
		if (bid.is_not_end()) {
			found = true;
			// If this is a valid replace
			if (self._is_valid_replace(bid.second(), size_delta, new_price)) {
				action = 'accept';
				// accept the replace
				self.emit(OrderEvent.replace, {
					trans_id: self.trans_id_,
					order: order,
					open_qty: bid.second().open_qty(),
					size_delta: size_delta,
					new_price: new_price});
				self.emit(OrderEvent.book_update, self.trans_id_);

				var new_open_qty = bid.second().open_qty() + size_delta;
				bid.second().change_qty(size_delta);
				// If the size change will close the order
				if (!new_open_qty) {
					action = 'cancel';
					// Cancel with NO open qty (should be zero after replace), emit cancel event
					self.emit(OrderEvent.cancel, {trans_id: self.trans_id_, order: order, open_qty: 0});
					self.bids_.erase(bid); // Remove order
					// Else rematch the new order - there could be a price change
					// or size change - that could cause all or none match
				} else {
					matched = self._add_order(bid, price); // Add order
					self.bids_.erase(bid); // Remove order
				}
			}
		}
	} else {
		// Else the order to replace is a sell order
		var ask = self._find_ask(order);
		// If the order was found
		if (ask.is_not_end()) {
			found = true;
			// If this is a valid replace
			if (self._is_valid_replace(ask.second(), size_delta, new_price)) {
				// Accept the replace, emit replace_accept event
				self.emit(OrderEvent.replace, {
					trans_id: self.trans_id_,
					order: order,
					open_qty: ask.second().open_qty(),
					size_delta: size_delta,
					price: price
				});
				self.emit(OrderEvent.book_update, self.trans_id_);

				var new_open_qty = ask.second().open_qty() + size_delta;
				ask.second().change_qty(size_delta); // Update my copy
				// If the size change will close the order
				if (!new_open_qty) {
					// Cancel with NO open qty (should be zero after replace), emit cancel event
					self.emit(OrderEvent.cancel, {trans_id: self.trans_id_, order: order, open_qty: 0});
					self.asks_.erase(ask); // Remote order
					// Else rematch the new order if there is a price change or the order
					// is all or none (for which a size change could cause it to match)
				} else if (price_change || ask.second().all_or_none()) {
					matched = self._add_order(ask.second(), price); // Add order
					self.asks_.erase(ask); // Remove order
				}
			}
		}
	}

	if (!found) {
		return callback('order not found');
	}

	callback(null, {trans_id: self.trans_id_, order: order, matched: matched})
};

/// @brief match a new ask to current bids
/// @param inbound_order the inbound order
/// @param inbound_price price of the inbound order
/// @return true if a match occurred
OrderBook.prototype._match_bids_order = function(inbound, inbound_price) {
	var self = this;
	var matched = false;
	var matched_qty = 0;
	var inbound_qty = inbound.open_qty();

	for (var bid = self.bids_.begin(); bid.is_not_end(); ) {
		// If the inbound order matches the current order
		if (self._matches(inbound, inbound_price, inbound.open_qty() - matched_qty, bid.second(), bid.first(), false)) {
			// If the inbound order is an all or none order
			if (inbound.all_or_none()) {
				// Track how much of the inbound order has been matched
				matched_qty += bid.second().open_qty();
				// If we have matched enough quantity to fill the inbound order
				if (matched_qty >= inbound_qty) {
					matched = true;

					// Unwind the deferred crosses
					var it = new Iterator(self.deferred_bid_crosses_);
					var next = it.next();
					while (!next.done) {
						var dbc = next.value;
						// Adjust tracking values for cross
						self._cross_orders(inbound, dbc.second());
						// If the existing order was filled, remove it
						if (dbc.second().filled()) {
							self.bids_.erase(dbc);
						}
						next = it.next();
					}
					// Else we have to defer crossing this order
				} else {
					self.deferred_bid_crosses_.push(bid);
					bid.next();
				}
			} else {
				matched = true;
			}

			if (matched) {
				// Adjust tracking values for cross
				self._cross_orders(inbound, bid.second());

				// If the existing order was filled, remove it
				if (bid.second().filled()) {
					self.bids_.erase(bid);
				} else {
					bid.next();
				}

				// if the inbound order is filled, no more matches are possible
				if (inbound.filled()) {
					break;
				}
			}
			// Didn't match, exit loop if this was because of price
		} else if (bid.first() < inbound_price) {
			break;
		} else {
			bid.next();
		}
	}

	return matched;
};

/// @brief match a new ask to current asks
/// @param inbound_order the inbound order
/// @param inbound_price price of the inbound order
/// @param asks current asks
/// @return true if a match occurred
OrderBook.prototype._match_asks_order = function(inbound, inbound_price) {
	var self = this;
	var matched = false;
	var matched_qty = 0;
	var inbound_qty = inbound.open_qty();

	for (var ask = self.asks_.begin(); ask.is_not_end(); ) {
		// If the inbound order matches the current order
		if (self._matches(inbound, inbound_price, inbound.open_qty() - matched_qty, ask.second(), ask.first(), true)) {
			// If the inbound order is an all or none order
			if (inbound.all_or_none()) {
				// Track how much of the inbound order has been matched
				matched_qty += ask.second().open_qty();
				// If we have matched enough quantity to fill the inbound order
				if (matched_qty >= inbound_qty) {
					matched = true;

					// Unwind the deferred crosses
					var it = new Iterator(self.deferred_ask_crosses_);
					var next = it.next();
					while (!next.done) {
						var dbc = next.value;
						// Adjust tracking values for cross
						self._cross_orders(inbound, dbc.second());
						// If the existing order was filled, remove it
						if (dbc.second().filled()) {
							self.asks_.erase(dbc);
						}
						next = it.next();
					}
				// Else we have to defer crossing this order
				} else {
					self.deferred_ask_crosses_.push(ask);
					ask.next();
				}
			} else {
				matched = true;
			}

			if (matched) {
				// Adjust tracking values for cross
				self._cross_orders(inbound, ask.second());

				if (inbound.ptr().is_filled_limit() === true && inbound.ptr().is_filled_limit_complete() === true){
					break;
				}

				// If the existing order was filled, remove it
				if (ask.second().filled()) {
					self.asks_.erase(ask);
				} else {
					ask.next();
				}


				// if the inbound order is filled, no more matches are possible
				if (inbound.filled()) {
					break;
				}
			}
		// Didn't match, exit loop if this was because of price
		} else if (ask.first() > inbound_price) {
			break;
		} else {
			ask.next();
		}
	}

	return matched;
};

/// @brief perform fill on two orders
/// @param inbound_tracker the new (or changed) order tracker
/// @param current_tracker the current order tracker
OrderBook.prototype._cross_orders = function(inbound_tracker, current_tracker) {
	var fill_qty = Math.min(inbound_tracker.open_qty(), current_tracker.open_qty());
	var cross_price = current_tracker.ptr().price();
	var fill_limit = inbound_tracker.ptr().filled_limit();
	var fill_cost = inbound_tracker.ptr().filled_cost();
	var self = this;

    //var tmp_qty = 0;
	if ((fill_limit <= (fill_cost + fill_qty * cross_price) && inbound_tracker.ptr().is_filled_limit() === true)){
		fill_qty = Math.floor(((fill_limit - fill_cost) / cross_price) * 100) / 100;
		inbound_tracker.ptr().set_filled_limit_complete(true);
	}

	// If current order is a market order, cross at inbound price
	if (OrderPrice.MARKET_ORDER_PRICE === cross_price) {
		cross_price = inbound_tracker.ptr().price();
	}
	inbound_tracker.fill(fill_qty, cross_price);
	current_tracker.fill(fill_qty, cross_price);

	var fill_flags = FillFlags.ff_neither_filled;
	if (!inbound_tracker.open_qty()) {
		fill_flags |= FillFlags.ff_inbound_filled;
	}
	if (!current_tracker.open_qty()) {
		fill_flags |= FillFlags.ff_matched_filled;
	}

	self.emit(OrderEvent.fill, {
		trans_id: self.trans_id_,
		inbound_order: inbound_tracker.ptr(),
		matched_order: current_tracker.ptr(),
		fill_qty: fill_qty,
		fill_price: cross_price,
		fill_flags: fill_flags
	})
};

/// @brief perform validation on the order, and create reject callbacks if not
/// @param order the order to validate
/// @return true if the order is valid
OrderBook.prototype._is_valid = function(order, conditions) {
	if (order.order_qty() === 0) {
		return false;
	} else {
		return true;
	}
};

/// @brief perform validation on the order replace, and create reject
///   callbacks if not
/// @param order the order to validate
/// @param size_delta the change in size (+ or -)
/// @param new_price the new order price
/// @return true if the order replace is valid
OrderBook.prototype._is_valid_replace = function(order, size_delta, new_price) {
	var size_decrease = size_delta < 0;
	// If there is not enough open quantity for the size reduction
	if (size_decrease && order.open_qty() < Math.abs(size_delta)) {
		return false;
	}
	return true;
};

/// @brief find a bid
OrderBook.prototype._find_bid = function(order) {
	// Find the order search price
	var search_price = this._sort_price(order);
	var result = this.bids_.find(search_price);
	for (; result.is_not_end(); result.next()) {
		// If this is the correct bid
		if (result.second().ptr().order_id_ === order.order_id_) {
			break;
			// Else if this bid's price is too low to match the search price
		} else if (result.first() < search_price) {
			result = this.bids_.end();
			break; // No more possible
		}
	}
	return result;
};

/// @brief find an ask
OrderBook.prototype._find_ask = function(order) {
	// find the order search price
	var search_price = this._sort_price(order);
	var result = this.asks_.find(search_price);
	for (; result.is_not_end(); result.next()) {
		// If this is the correct ask
		if (result.second().ptr().order_id_ === order.order_id_) {
			break;
			// Else if this ask's price is too high to match the search price
		} else if (result.first() > search_price) {
			result = this.asks_.end();
			break; // No more possible
		}
	}
	return result;
};

/// @brief match an inbound with a current order
OrderBook.prototype._matches = function(inbound_order, inbound_price, inbound_open_qty, current_order, current_price, inbound_is_buy) {
	// Check for price mismatch
	if (inbound_is_buy) {
		// If the inbound buy is not as high as the existing sell
		if (inbound_price < current_price) {
			return false;
		}
	} else {
		// Else if the inbound sell is not as low as the existing buy
		if (inbound_price > current_price) {
			return false;
		}
	}

	if (current_order.all_or_none()) {
		// Don't match current if not completely filled
		if (current_order.open_qty() > inbound_open_qty) {
			return false;
		}
	}

	// If the inbound order is all or none, we can only check quantity after
	// all matches take place
	return true;
};

OrderBook.prototype._sort_price = function(order) {
	var result_price = order.price();
	if (result_price === OrderPrice.MARKET_ORDER_PRICE) {
		result_price = (order.is_buy() ? OrderPrice.MARKET_ORDER_BID_SORT_PRICE
			: OrderPrice.MARKET_ORDER_ASK_SORT_PRICE);
	}
	return result_price;
};

OrderBook.prototype._add_order = function(inbound, order_price) {
	var matched = false;
	var order = inbound.ptr();
	// Try to match with current orders
	if (order.is_buy()) {
		matched = this._match_asks_order(inbound, order_price);
	} else {
		matched = this._match_bids_order(inbound, order_price);
	}

	// If order has remaining open quantity and is not immediate or cancel
	if (inbound.open_qty() && !inbound.immediate_or_cancel() && inbound.ptr().is_filled_limit() === false) {
		// If this is a buy order
		if (order.is_buy()) {
			// Insert into bids
			this.bids_.insert(order_price, inbound);
			// Else this is a sell order
		} else {
			// Insert into asks
			this.asks_.insert(order_price, inbound);
		}
	}
	return matched;
};

OrderBook.prototype.market_depth = function() {
	var self = this;
	return {
		asks: self.asks(),
		bids: self.bids()
	};
};

/**
 * return aggregate asks
 * @returns {Array}
 */
OrderBook.prototype.asks = function() {
	return this.asks_.data();
};

/**
 * return aggregate bids
 * @returns {Array}
 */
OrderBook.prototype.bids = function() {
	return this.bids_.data();
};

module.exports = OrderBook;
