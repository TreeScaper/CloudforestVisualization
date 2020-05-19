/**
 * Module for all Galaxy interaction
 */
let event_build_fn = undefined;
let file_objects = undefined; //Holds array of file objects from history
let href = undefined;
let history_id = undefined;

const admin_key = "?key=admin";
const USE_KEY = false;

const string_parser = function (s) {
    const split_data = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    let parsed_data = [];
    split_data.forEach(d => {
        parsed_data.push(d.split(/\t/));
    });
    return parsed_data;
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
        let r_obj = {};
        r_obj[f_obj.name] = formatted_contents;
        return r_obj;
    }
}

const array_to_dict = function (arr) {
    let r_dict = {};
    arr.forEach(e => {
        let k = Object.keys(e)[0];
        r_dict[k] = e[k];
    })
    return r_dict;
}

const send_file_contents = async (obj, event = "FileContents") => {
    let funcs = [];
    obj.files.forEach(file_name => {
        const g_f_obj = file_objects.filter(fo => fo.name === file_name);
        funcs.push(fetch_decode(g_f_obj[0]));
    });
    let file_contents = [];
    for (const f of funcs) {
        file_contents.push(await f());
    }
    dispatchEvent(event_build_fn(event, {
        guid: obj.guid,
        contents: array_to_dict(file_contents)
    }));
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
        switch (ext) {
            case 'cloudforest':
            case 'nhx':
            case 'nexus':
            case 'nex':
            case 'newick':
                r_val = true;
                break;
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
    dispatchEvent(event_build_fn("DataPrimed", {}));
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

const file_names = function () {
    let r_val = [];
    file_objects.forEach(f_obj => {
        r_val.push(f_obj.name);
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

const set_event_listeners = function () {

    addEventListener("PublishData", e => {
        galaxy_upload(e.detail.data, e.detail.file_name);
    });

    addEventListener("AvailableFilesRequest", e => {
        const request_guid = e.detail.guid;
        dispatchEvent(event_build_fn("AvailableFiles", {
            guid: request_guid,
            files: file_names()
        }));
    });

    addEventListener("FileContentsRequest", e => {
        send_file_contents({
            guid: e.detail.guid,
            files: e.detail.files
        });
    });

    //a consensus tree file will be named: Consensus Tree
    //a bootstrapped tree file will, generally, contain the *.boottrees.* in the name.
    addEventListener("TreeFileContentsRequest", e => {
        let tree_files = [];

        e.detail.files.forEach(f => {
            file_objects.forEach(fo => {
                if (f === fo.name) {
                    tree_files.push(f);
                }
            });
        });
        send_file_contents({
            guid: e.detail.guid,
            files: tree_files
        }, "TreeFileContents");
    });

    addEventListener("BootstrappedTrees", e => {
        let tree_files = [];
        file_objects.forEach(fo => {
            if (RegExp(/.*boottrees*/).test(fo.name)) {
                tree_files.push(fo.name);
                send_file_contents({
                    guid: e.detail.guid,
                    files: tree_files
                }, "BootstrappedTreeData");
            }
        });
    });
}

const galaxy_data_init = function (init_obj) {
    let { guid_fn, event_fn, conf_elem_id } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    set_event_listeners();

    const config_elem = document.getElementById(conf_elem_id);
    href = config_elem.getAttribute("href")
    history_id = config_elem.getAttribute("history-id");
    parse_galaxy_history(href, history_id);
}

export { galaxy_data_init }