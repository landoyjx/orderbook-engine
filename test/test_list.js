/**
 * Created by landoyjx on 2017/2/8.
 */
var List = require('collections/list');
var Iterator = require('collections/iterator');

var list = new List([1, 3, 5, 2, 9, 0, 2]);

var it = new Iterator(list);
var next = it.next();
while (!next.done) {
    console.log(next.value);
    next = it.next();
}
