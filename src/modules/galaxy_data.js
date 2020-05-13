/**
 * Module for all Galaxy interaction
 */
let event_build_fn = undefined;
let data_files = {}; //Holds the history data entries
let file_objects = undefined; //Holds array of file objects from history

const string_parser = function (s) {
    const split_data = s.split(/\r?\n|\r/g).filter(v => v.length > 0);
    let parsed_data = [];
    split_data.forEach(d => {
        parsed_data.push(d.split(/\t/));
    });
    return parsed_data;
};

const get_data = function (data_name) {
    return string_parser(data[data_name]);
};

//HOW THIS? 
// 1-are contents in cache
// 2-get contents from galaxy, place in cache
const send_file_contents = function (obj) {
    let file_contents = {};
    obj.files.forEach(f => {
        file_contents[f] = get_data(f);
    });
    dispatchEvent(event_build_fn("FileContents", {
        guid: obj.guid,
        contents: file_contents
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
    const data = JSON.parse(raw_data);
    const filename_check = function (name) {
        let r_val = false;
        if (RegExp(/.*tree.*/).test(name)) {
            r_val = true;
        }
        if (RegExp(/.*nex^||*.nexus^/).test(name)) {
            r_val = true;
        }
        if (RegExp(/.*newick^||.*nhx^/).test(name)) {
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
    let r_val = data.filter(obj => {
        return (filetype_check(obj.extension) || filename_check(obj.name)) && obj.state === 'ok' && !obj.deleted;
    });
    return r_val;
};

const process_history_contents = function (data) {
    let f_data = filter_data(data);
    file_objects = f_data;
    dispatchEvent("DataPrimed", {});
};

const parse_galaxy_history = function (href, history_id) {
    const prod_api_call = `${href}/api/histories/${history_id}/contents`;

    fetch(prod_api_call)
        .then(response => {
            return response.text();
        })
        .then(data => {
            process_history_contents(data);
        })
        .catch(function (error) {
            console.error(`We have an error trying to discover history ${history_id} : ${error}`);
        });

}

const file_names = function () {
    let r_val = [];
    data_files.forEach(f_obj => {
        r_val.push(f_obj.name);
    });
    return r_val;
};


const set_event_listeners = function () {
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

    addEventListener("BootstrappedTrees", () => {
        let fc = {};
        fc["Boottrees"] = get_data("Boottrees");
        dispatchEvent(event_build_fn("BootstrappedTreeData"), {
            guid: "",
            files: fc
        });
    });
}

const galaxy_data_init = function (init_obj) {
    let { guid_fn, event_fn, conf_elem_id } = init_obj;
    event_build_fn = event_fn;
    const my_guid = guid_fn();

    set_event_listeners();

    const config_elem = document.getElementById(conf_elem_id);
    const href = config_elem.getAttribute("href")
    const history_id = config_elem.getAttribute("history-id");
    parse_galaxy_history(href, history_id);
}

export { galaxy_data_init }