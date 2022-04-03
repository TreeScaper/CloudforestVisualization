/**
 * Manage TreeScaper bipartition parsing and data requests.
 */
import { build_event } from "./support_funcs";

let bipartition_files = { matrix: undefined, counts: undefined, taxa: undefined };
let trees_by_partition = undefined;
let partition_taxa = undefined;
let taxa_array = [];
/**
* Parses the TreeScaper bipartition matrix producing a BP -> tree object.
* Key: bipartition number; Value: array of trees where the bipartition is present.
* 
* @param {[]} m - Bipartition Matrix generated by TreeScaper
*/
const parse_bipartition = function (m) {
    let b = {};
    m.forEach(r => {
        let bp_name = String(Number(r[0].trim()) + 1);
        if (!(bp_name in b)) {
            b[bp_name] = [];
        }
        b[bp_name].push(Number(r[1] + 1));
    });
    return b;
}
/**
 * Parse the bipartion count file
 * 
 *  0, 000000000000000010011000000, 11
    1, 001111111111000000000100000, 10
    2, 001100001111111111111011110, 1
    3, 000011111111111100000011110, 1
 * 
 * @param {*} m - bipartition count file. An array of strings
 */
const parse_taxa_partitions = function (m) {
    let part_taxa = {};
    m.forEach(line => {
        let arr = line[0].split(',');
        let bp = Number(arr[0]) + 1;
        part_taxa[bp] = [];
        arr[1].trim().split("").forEach((e, idx) => {
            if (e === "1") {
                part_taxa[bp].push(taxa_array[idx]);
            }
        });
    });
    return part_taxa;
}

const bipartions_for_tree = function (tree_num) {
    let target = Number(tree_num);
    let bipartitions = []
    let taxa = {};
    Object.keys(trees_by_partition).forEach(key => {
        if (trees_by_partition[key].indexOf(target) > -1) {
            bipartitions.push(key);
            taxa[key] = part_taxa[key];
        }
    });
    dispatchEvent(build_event("BipartitionsForTree", {
        partitions: bipartitions,
        taxa: taxa
    }));
}

//REFACTOR THIS TO ONE MODULE
const clean_data = function(data) {
    let t_arr = data.split('\n');
    let arr = []
    t_arr.forEach(d => {
        if (d.length > 0) {
            arr.push(d.split('\t')); 
        }
    });
    return arr;
}

const bipartition_data_init = function (init_obj) {
    let { guid_fn } = init_obj;
    const my_guid = guid_fn();

    addEventListener("BipartitionsForTreeRequst", e => {
        bipartions_for_tree(e.detail.tree_num);
    });

    addEventListener("FileContents", e => {
        if (e.detail.guid === my_guid) {
            let matrix_data = undefined;
            let counts_data = undefined;
            let taxa_ids = undefined;
            e.detail.contents.forEach(entry => {
                if (entry.fileName === bipartition_files.matrix.name) {    
                    matrix_data = clean_data(entry.data);
                }
                if (entry.fileName === bipartition_files.counts.name) {
                    
                    counts_data = clean_data(entry.data);
                }
                if (entry.fileName === bipartition_files.taxa.name) {
                    taxa_ids = entry.data;
                      
                }
            });
            let arr = taxa_ids.split(',');
            arr.forEach(e => {
                taxa_array.push(e[0].trim());
            });
            trees_by_partition = parse_bipartition(matrix_data);
            partition_taxa = parse_taxa_partitions(counts_data);
        }
    });

    addEventListener("BipartitionFiles", e => {
        if (e.detail.files.length > 0) {
            let m = e.detail.files.filter(obj => RegExp(/[Bb]ipartition [Mm]atrix/).test(obj.name));
            let l = e.detail.files.filter(obj => RegExp(/[Bb]ipartition [Cc]ounts/).test(obj.name));
            let t = e.detail.files.filter(obj => RegExp(/Taxa IDs/).test(obj.name));
            bipartition_files.matrix = m[0];
            bipartition_files.counts = l[0];
            bipartition_files.taxa = t[0];
            dispatchEvent(build_event("FileContentsRequest", {
                guid: my_guid,
                files: [bipartition_files.matrix.dataset_id, bipartition_files.counts.dataset_id, bipartition_files.taxa.dataset_id]
            }));
        } else {
            console.error('History does not contain CLVTreescaper -dist files.');
        }
    });

    dispatchEvent(build_event("RequestBipartitionFile", {}));
}

export { bipartition_data_init }
