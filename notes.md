# Migration

    <script src="https://d3js.org/d3-array.v2.min.js"></script>
    <script src="https://d3js.org/d3-selection.v1.min.js"></script>
    <script src="https://d3js.org/d3-hierarchy.v1.min.js"></script>
    <script src="index.js"></script>



# API Tool Run

    http://localhost:8080/api/histories/f597429621d6eb2b/contents/d413a19dec13d11e

    {....
        "creating_job: df7a1f0c02a5b08e,
    ...
    }

    http://localhost:8080/api/jobs/df7a1f0c02a5b08e/build_for_rerun

    {
        ...
        state_inputs[input_file] "{\"values\": [{\"id\": 1, \"src\": \"hda\"}]}"
        ...
    }
## Payload

    {
        "history_id":"f597429621d6eb2b",
        "tool_id":"treescaper-trees",
        "tool_version":"0.1.0",
        "inputs":{
            "input_file":{"values":[{"src":"hda","hid":1}],"batch":false},
            "input_file_type":"Trees",
            "tree_output|output_type":"Community",
            "tree_output|t":"Affinity",
            "tree_output|cm":"CPM",
            "tree_output|hf":"0.0",
            "tree_output|lf":"0.0",
            "tree_output|plateau_options|lm":"manual",
            "tree_output|plateau_options|lambda_sign":"true",
            "tree_output|plateau_options|fixed_lambda":"0.0",
            "tree_output|plateau_options|start_lambda":"0.0",
            "tree_output|plateau_options|end_lambda":"0.5",
            "tree_output|plateau_options|interval_lambda":"0.1",
            "weigted_tree":"0",
            "rooted_tree":"0",
            "subsample|subsample_selector":"no_subsample"}
    }
