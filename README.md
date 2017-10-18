# Comments Plugin

This plugin helps posting the comments to the blogs or websites in the SAFE Browser. This can be integrated with any webpages.

## How to Use

To use this plugin, upload `comment.js` from the build folder to your website using Web Hosting Manager.

Add the script to your html page:

```HTML
<script src="comment.js"></script>
<script>
  window.safeComments('CommentTitle', 'CommentTargetID');
</script>
```

## Build the Plugin

1. Clone the project
    ```bash
    $ git clone https://github.com/<>.git
    ```

2. Install the Node.js dependencies.
    ```bash
    $ yarn
    ```

3. `yarn run build` will build the plugin to the `build` folder.