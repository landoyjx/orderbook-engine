/**
 * Created by landoyjx on 2017/2/8.
 */
var MultiMap = require('../lib/multimap');
var map = new MultiMap(true);

map.insert(10, 'a');
map.insert(12, 'b');
map.insert(10, 'c');
map.insert(20, 'd');
map.insert(15, 'e');
map.insert(2, 'f');
map.insert(0, 'g');

map.print();
console.log('---');

var it = map.find(12);
map.erase(it);
map.print();

console.log('---');
var it = map.find(10);
map.erase(it);
map.print();

