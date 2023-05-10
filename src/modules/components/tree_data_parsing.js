/**
 * Parse nexis and newick data into tree format
 */

/**
* Newick tree parsing from 
* https://github.com/jasondavies/newick.js
* 
*/

const length_schemes = [
    {name: 'raw', description: 'Raw dataset lengths'},
    {name: 'normalized', description: 'Branch lengths normalized'},
    {name: 'normalized_rtt', description: 'Root-to-tip distance normalized'},
];

let newick_parse = function (s, length_scheme='raw', translate_table = {}) {
    var ancestors = [];
    var tree = {max_child_depth: 0};
    let max_depth = 0;
    let current_depth = 0;
    var tokens = s.split(/\s*(;|\(|\)|,|:)\s*/);

    // Find maximum depth first, because it is needed to assign lengths
    if (length_scheme == 'normalized_rtt') {
        for (const token of tokens) {
            switch (token) {
                case '(': // new branchset
                    current_depth++;
                    if (current_depth > max_depth) {
                        max_depth = current_depth;
                    }
                    break;
                case ')':
                    current_depth--;
                    break;
                default:
                    break;
            }
        }
    }

    for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];
        switch (token) {
            case '(': // new branchset
                var subtree = {};
                subtree.max_child_depth = 0;
                tree.branchset = [subtree];
                ancestors.push(tree);
                current_depth++;
                tree = subtree;
                break;
            case ',': // another branch
                var subtree = {};
                subtree.max_child_depth = 0;
                ancestors[ancestors.length - 1].branchset.push(subtree);
                tree = subtree;
                break;
            case ')': // optional name next
                var subtree_max_depth = tree.max_child_depth;
                tree = ancestors.pop();
                tree.max_child_depth = Math.max(...tree.branchset.map((subtree) => subtree.max_child_depth)) + 1;

                // In this case, we set the lengths of subling branches as relative to each other.
                if (length_scheme === 'normalized_rtt') {
                    for (const subtree of tree.branchset) {
                        subtree.length = (tree.max_child_depth - subtree.max_child_depth) / max_depth;
                    }
                }

                //console.log(tree, subtree);
                current_depth--;
                break;
            case ':': // optional length next
                break;
            default:
                var x = tokens[i - 1];
                if (x == ':' && length_scheme == 'raw') {
                    tree.length = parseFloat(token);
                } else if (x == ')' || x == '(' || x == ',') {
                    if (translate_table[token] != null) {
                        tree.name = translate_table[token];
                    } else {
                        tree.name = token;
                    }
                    if (tree.length === undefined) {
                        tree.length = 1;
                    }
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
let nexus_parse = function (s, length_scheme='raw') {
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
    let np = tree_table.map(v => newick_parse(v, length_scheme, translate_table));
    return np;
};

export { newick_parse, nexus_parse, length_schemes}
