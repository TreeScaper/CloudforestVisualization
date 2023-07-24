
/**
 * Module for all Galaxy data interaction. 
 * Retrieves data from Galaxy via the published API.
 * Sends data to Galaxy where the stream is saved as a file within the current history.
 * 
 * GET:
 *  Data is cleaned and parsed into a js object, then published in an event.
 *  An example:
 *      {
 *          fileName: "Distance_Test.out",
 *          header: {
 *                      created: "7_26_8_49",
                        distance_type: "Robinson-Foulds",
                        node_feature: "weighted, unrooted",
                        node_type: "Tree",
                        output_type: "Distance matrix",
                        size: 1188,
                        source: "working_dir/cats_subsampled.boottrees"
 *                  }
            data: "........STRING........"
 *      }
 * 
 */
import { build_event } from "./utilities/support_funcs";

let file_objects = undefined; //Holds array of file objects from history
let href = undefined;
let history_id = undefined;
let bipartition_files = undefined;
let nldr_coordinate_files = undefined;
let community_detection_files = undefined;
let affinity_matrix_files = undefined;

const admin_key = "?key=admin";
const USE_KEY = false;

/**
 * Parses the header on CLVTreescaper data files.
 *  created:7_26_8_49
    format:taxon id, taxon name
    output_type:Taxon ID
    size:27
    source:working_dir/cats_subsampled.boottrees

    Returns an object of key value pairs.
 */
const parse_header = function(s) {
    const split_data = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    let rVal = {};
    split_data.forEach(d => {
        let k_v = d.split(/:/);
        rVal[k_v[0]] = k_v[1];
    });
    return rVal;
}

const string_parser = function (s) {
    let rVal = {
        fileName: undefined,
        header: undefined,
        data: undefined
    };

    const regex = /<([\S|\s]*)>([\S|\s]*)/gm;
    let match = regex.exec(s);
    
    if (match) {
        rVal.header = parse_header(match[1]);
        rVal.data = match[2];
    } else {
        rVal.data = s;
    }

    return rVal;
};

const fetch_decode = (f_obj) => {
    return async () => {
        let api_url = `${href}${f_obj.url}/display`;
        if (USE_KEY) {
            api_url += admin_key;
        }
        let response = await fetch(api_url);
        let contents = await response.text();
        let formatted_contents = string_parser(contents);
        formatted_contents.fileName = f_obj.name;
        formatted_contents.fileExt = f_obj.extension;
        return formatted_contents;
    }
}


const get_file_contents = async (files, callback) => {
    let funcs = [];
    files.forEach(file_id => {
        const g_f_obj = file_objects.filter(fo => fo.dataset_id === file_id);
        funcs.push(fetch_decode(g_f_obj[0]));
    });
    let file_contents = [];
    for (const f of funcs) {
        file_contents.push(await f());
    }

    callback(file_contents);
}

/**
 * [
 *  {"history_content_type": "dataset", 
 * "update_time": "2020-05-11T16:00:40.190551", "name": "example.phy.boottrees", "extension": "txt", 
 * "type_id": "dataset-f2db41e1fa331b3e", "deleted": false, "history_id": "f597429621d6eb2b", 
 * "tags": [], "id": "f2db41e1fa331b3e", "visible": true, "state": "ok", 
 * "create_time": "2020-05-07T15:50:12.032824", "hid": 1, 
 * "url": "/api/histories/f597429621d6eb2b/contents/f2db41e1fa331b3e", "dataset_id": "f2db41e1fa331b3e", 
 * "type": "file", "purged": false}, 
 * ... ]
 * 
 * @param {*} raw_data 
 */
const filter_data = function (raw_data) {
    const filename_check = function (name) {
        let r_val = false;
        if (RegExp(/.*tree.*/).test(name)) {
            r_val = true;
        }
        if (RegExp(/.*nex^|.*nexus^/).test(name)) {
            r_val = true;
        }
        if (RegExp(/.*newick^|.*nhx^/).test(name)) {
            r_val = true;
        }
        return r_val;
    };
    const filetype_check = function (ext) {
        let r_val = false;
        if (RegExp(/cloudforest/).test(ext)) {
            r_val = true;
        }
        if (RegExp(/nex/).test(ext)) {
            r_val = true;
        }
        if (RegExp(/newick|nhx/).test(ext)) {
            r_val = true;
        }
        return r_val;
    };
    let r_val = raw_data.filter(obj => {
        return (filetype_check(obj.extension) || filename_check(obj.name)) && obj.state === 'ok' && !obj.deleted;
    });
    return r_val;
};

const process_history_contents = function (data) {
    let f_data = filter_data(data);
    file_objects = f_data;

    // Get all files to allow module to find correct items.
    bipartition_files = file_objects;
    nldr_coordinate_files = file_objects.filter(obj => RegExp(/cloudforest\.coordinates/).test(obj.extension));

    // Get all files to allow module to find correct items.
    community_detection_files = file_objects;
    affinity_matrix_files = file_objects.filter(obj => RegExp(/cloudforest\.cd/).test(obj.extension) || RegExp(/cloudforest\.affinity/).test(obj.extension));

    dispatchEvent(build_event("DataPrimed", {}));
};

const parse_galaxy_history = function (href, history_id) {
    let prod_api_call = `${href}/api/histories/${history_id}/contents`;
    if (USE_KEY) {
        prod_api_url += admin_key;
    }
    fetch(prod_api_call)
        .then(response => {
            return response.text();
        })
        .then(data => {
            process_history_contents(JSON.parse(data));
        })
        .catch(function (error) {
            console.error(`We have an error trying to discover history ${history_id} : ${error}`);
        });

}

const file_identifiers = function () {
    let r_val = [];
    file_objects.forEach(f_obj => {
        r_val.push({ name: f_obj.name, id: f_obj.dataset_id, extension: f_obj.extension, hid: f_obj.hid });
    });
    return r_val;
};

const galaxy_upload = function (data, file_name) {
    let payload = {
        'files_0|url_paste': null,
        'dbkey': '?',
        'file_type': 'txt',
        'files_0|type': 'upload_dataset',
        'files_0|space_to_tab': null,
        'files_0|to_posix_lines': 'Yes',
        'files_0|NAME': file_name
    };
    let postData = {
        history_id: history_id,
        tool_id: 'upload1',
        inputs: null
    };
    payload['files_0|url_paste'] = JSON.stringify(data);
    postData.inputs = payload;

    let api_url = `${href}/api/tools`;
    if (USE_KEY) {
        api_url += admin_key;
    }

    fetch(api_url, {
        method: 'POST',
        body: JSON.stringify(postData),
    })
        .then(response => response.json())
        .then(data => {
            console.log('Upload Success:', data);
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

const available_files_request = function () {
    return file_identifiers();
}

const data_manager_init = function (init_obj) {
    let { conf_elem_id } = init_obj;

    const config_elem = document.getElementById(conf_elem_id);
    href = config_elem.getAttribute("href")
    history_id = config_elem.getAttribute("history-id");
    parse_galaxy_history(href, history_id);
}

export {
    data_manager_init,
    available_files_request,
    get_file_contents
}
