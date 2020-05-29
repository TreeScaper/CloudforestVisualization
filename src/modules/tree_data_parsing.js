/**
 * Parse nexis and newick data into tree format
 */

/**
* Newick tree parsing from 
* https://github.com/jasondavies/newick.js
* 
*/
let newick_parse = function (s, translate_table = {}) {
    var ancestors = [];
    var tree = {};
    var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);
    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        switch (token) {
            case '(': // new branchset
                var subtree = {};
                tree.branchset = [subtree];
                ancestors.push(tree);
                tree = subtree;
                break;
            case ',': // another branch
                var subtree = {};
                ancestors[ancestors.length - 1].branchset.push(subtree);
                tree = subtree;
                break;
            case ')': // optional name next
                tree = ancestors.pop();
                break;
            case ':': // optional length next
                break;
            default:
                var x = tokens[i - 1];
                if (x == ')' || x == '(' || x == ',') {
                    if (translate_table[token] != null) {
                        tree.name = translate_table[token];
                    } else {
                        tree.name = token;
                    }
                } else if (x == ':') {
                    tree.length = parseFloat(token);
                }
        }
    }
    return tree;
};

/**
 * Nexus file parsing for embedded newick trees.
 * 
 * @param {String} s 
 */
let nexus_parse = function (s) {
    if (s.search(/NEXUS/) === -1) {
        throw ('Parameter is not a Nexus string.');
    }
    let lines = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    lines = lines.map(l => l.trim());

    let translate_table = {};
    let tree_table = [];

    let in_begin_trees = false;
    let in_translate = false;
    lines.forEach(lp => {
        let l = lp.toLocaleLowerCase();
        if (l.includes('begin trees')) {
            in_begin_trees = true;
        }
        if (in_begin_trees && l.includes('end;')) {
            in_begin_trees = false;
        }
        if (l.includes('translate')) {
            in_translate = true;
        }
        if (in_translate && !l.includes('translate')) {
            let ar = l.replace(/,|;/, '').split(/\s/).filter(v => v.length > 0);
            translate_table[ar[0]] = ar[1];
        }
        if (in_translate && l.endsWith(';')) {
            in_translate = false;
        }
        if (l.startsWith('tree') && in_begin_trees) {
            in_translate = false;
            tree_table.push(l.substr(l.indexOf('('), l.indexOf(';')));
        }
    });
    let np = tree_table.map(v => newick_parse(v, translate_table));
    return np;
};

let boottrees_parse = function (s) {
    let newick_objs = s.map(v => newick_parse(v[0]));
    return newick_objs;
};

export { newick_parse, nexus_parse, boottrees_parse }