import CommentModel from './models/CommentModel';

// Name of the MutableData that will be used for storing and retrieving comments
const MD_NAME = window.location.hostname;
// Unique TYPE_TAG for refering the MutableData. Number can be anything above the reserved rage (0-15000)
const TYPE_TAG = 15001;
// Contant vaalue used for holding the key and value used for setting the user as admin in app's own container
const IS_ADMIN = {
    key: 'isAdmin',
    value: 'true'
};
// Holds the name for the _publicNames container
const PUBLIC_NAMES_CONTAINER = '_publicNames';
// Constant value for the `.` Delimitter
const DOT = '.';
// Constatnt for holding the error messages
const ErrorMsg = {
    APP_NOT_INITIALISED: 'App is not yet initialised',
    PUBLIC_ID_DOES_NOT_MATCH: 'Public Id does not match. Can not set current user as admin'
};
// Enum Permissions - Holds the permission constants used by the application as an enum
const Permissions = {
    READ: 'Read',
    INSERT: 'Insert',
    UPDATE: 'Update'
};
// Enum ErrorCode - Holds the possible error codes expected
const ErrorCode = {
    REQUESTED_DATA_NOT_FOUND : -103,
};
// Authorisation model
const APP = {
    info: {
        id: MD_NAME,
        name: `${MD_NAME}-comment-plugin`,
        vendor: 'MaidSafe.net',
    },
    opts: {},
    containers: {
        _publicNames: [Permissions.READ],
    },
};
// Authorisation model for Admin/Owner who is registering the plugin
const APP_ADMIN = Object.assign(APP, { opts: { own_container: true } });

/**
 * SafeApi handles the SAFE Network related requests for managing the comments for a topic.
 * Topic is a key that will be used to save the comments.
 * Exposes function for the store/UI to save/retrieve comment list against a topic.
 * Also exposes other utility functions for getting Public ID list and also to validate the user is admin
 */
export default class SafeApi {

    constructor(topic, nwStateCb) {
        this.topic = topic;
        this.comments = [];
        this.app = undefined;
        this.mData = undefined;
        this.nwStateCb = (newState) => {
            console.log("Network state changed to: ", newState);
            nwStateCb(newState);
        };
    }

    /**
     * Fetches the public Ids associated for the user.
     */
    getPublicNames() {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this.app) {
                    return reject(new Error(ErrorMsg.APP_NOT_INITIALISED_ERROR));
                }
                // Get public names container handle
                const publicNamesContainerHandle = await window.safeApp.getContainer(this.app, PUBLIC_NAMES_CONTAINER);
                // Get handle for the keys for the public names container
                const keysHandle = await window.safeMutableData.getKeys(publicNamesContainerHandle);
                const keysLen = await window.safeMutableDataKeys.len(keysHandle);
                // If there is no Public ID return empty list
                if (keysLen === 0) {
                    return resolve([]);
                }
                const publicNames = [];
                // get all keys from the conatiner.
                await window.safeMutableDataKeys.forEach(keysHandle, (key) => {
                    publicNames.push(key);
                });
                const decryptedPublicNames = [];
                window.safeMutableDataKeys.free(keysHandle);
                // TODO free keysHandle
                // Decrypt the keys to get the actual Public ID
                await Promise.all(publicNames.map(async (p) => {
                    const decryptedValue = await window.safeMutableData.decrypt(publicNamesContainerHandle, p);
                    const toString = String.fromCharCode.apply(null, new Uint8Array(decryptedValue));
                    decryptedPublicNames.push(toString);
                }));
                window.safeMutableData.free(publicNamesContainerHandle);
                // TODO free publicNamesContainerHandle
                // resolve with the decrypted public names
                resolve(decryptedPublicNames);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Set the cuurent user as Admin/Owner.
     * Validate whether the current user is the own's the Public ID and insert isAdmin key in app's own container
     */
    setAsAdmin() {
        return new Promise(async (resolve, reject) => {
            try {
                const publicNames = await this.getPublicNames();
                const currPublicID = MD_NAME.split(DOT).slice(1).join(DOT);
                if (publicNames.length === 0 || publicNames.indexOf(currPublicID) === -1) {
                    return reject(new Error(ErrorMsg.PUBLIC_ID_DOES_NOT_MATCH));
                }
                const ownContainerHandle = await window.safeApp.getOwnContainer(this.app);
                const entriesHandle = await window.safeMutableData.getEntries(ownContainerHandle);
                const entriesCount = await window.safeMutableDataEntries.len(entriesHandle);
                if (entriesCount === 0) {
                    const mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
                    await window.safeMutableDataMutation.insert(mutationHandle, IS_ADMIN.key, IS_ADMIN.value);
                    await window.safeMutableData.applyEntriesMutation(ownContainerHandle, mutationHandle);
                    window.safeMutableDataMutation.free(mutationHandle);
                }
                window.safeMutableDataEntries.free(entriesHandle);
                window.safeMutableData.free(ownContainerHandle);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Set up the MutableData with Insert & Update permission for Everyone.
     * Create a Public Mutable Data with a deterministic name. (Hash(location.hostname))
     * Apply the permission set for the MutableData
     */
    setup() {
        return new Promise(async (resolve, reject) => {
            try {
                const hashedMDName = await window.safeCrypto.sha3Hash(this.app, MD_NAME);
                this.mData = await window.safeMutableData.newPublic(this.app, hashedMDName, TYPE_TAG);
                await window.safeMutableData.quickSetup(this.mData,
                    {},
                    `${MD_NAME} - Comment Plugin`,
                    `Comments for the hosting ${MD_NAME} is saved in this MutableData`);
                // create a new permission set
                const permSet = await window.safeMutableData.newPermissionSet(this.app);
                // allowing the user to perform the Insert operation
                await window.safeMutableDataPermissionsSet.setAllow(permSet, Permissions.INSERT);
                // allowing the user to perform the Update operation
                await window.safeMutableDataPermissionsSet.setAllow(permSet, Permissions.UPDATE);
                // setting the handle as null, anyone can perform the Insert/Update operation
                await window.safeMutableData.setUserPermissions(this.mData, null, permSet, 1);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Create the MutableData by computing the name deterministically based on location.hostname
     */
    createMutableDataHandle() {
        return new Promise(async (resolve, reject) => {
            try {
                // Initialising the app using the App info which requests for _publicNames container
                this.app = await window.safeApp.initialise(APP.info, this.nwStateCb);
                // Authorise the app and connect to the network using uri
                const uri = await window.safeApp.authorise(this.app, APP.containers, APP.opts);
                await window.safeApp.connectAuthorised(this.app, uri);
                // Compute the MutableData name
                const hashedName = await window.safeCrypto.sha3Hash(this.app, MD_NAME);
                this.mData = await window.safeMutableData.newPublic(this.app, hashedName, TYPE_TAG);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Authorise the app with own_container permission.
     * own_container is required for the admin to set the isAdmin key and value
     * The admin/owner is determined only based on this flag
     */
    authoriseAsAdmin() {
        return new Promise(async (resolve, reject) => {
            try {
                this.app = await window.safeApp.initialise(APP_ADMIN.info, this.nwStateCb);
                const uri = await window.safeApp.authorise(this.app, APP_ADMIN.containers, APP_ADMIN.opts);
                await window.safeApp.connectAuthorised(this.app, uri);
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Invoked to check whether the MuatbleData is set up.
     * Creates a unregistered client to try fetching the MutableData and get its entries.
     */
    isMDInitialised() {
        return new Promise(async (resolve, reject) => {
            try {
                const appHandle = await window.safeApp.initialise(APP.info, this.nwStateCb);
                // Connect as unregistered client
                await window.safeApp.connect(appHandle);
                const hashedName = await window.safeCrypto.sha3Hash(appHandle, MD_NAME);
                const mdHandle = await window.safeMutableData.newPublic(appHandle, hashedName, TYPE_TAG);
                // newPublic function only creates a handle in the local memmory.
                // The network operation is performed only when we call getEntries fo validating that the MutableData exists
                const entriesHandle = await window.safeMutableData.getEntries(mdHandle);
                window.safeMutableDataEntries.free(entriesHandle);
                window.safeMutableData.free(mdHandle);
                // TODO free mdHandle, entriesHandle
                await window.safeApp.free(appHandle);
                resolve(true);
            } catch (err) {
                if (err.code === ErrorCode.REQUESTED_DATA_NOT_FOUND) {
                    resolve(false);
                } else {
                    reject(err);
                }
            }
        });
    }

    /**
     * Invoked to authorise the user.
     * Sets up the comments MutableData if it is not already initialised.
     */
    authorise() {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Authorisation')
                const isInitialised = await this.isMDInitialised();
                if (!isInitialised) {
                    console.log('not initialised')
                    // Authorise the user as Admin (with app's own container)
                    await this.authoriseAsAdmin();
                    console.log('authorise admin')
                    // Set the user as Admin
                    await this.setAsAdmin();
                    console.log('set admin')
                    // Set up the MutableData
                    await this.setup();
                    console.log('setup finished')
                } else {
                    await this.createMutableDataHandle();
                }
                resolve();
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Check whether the user is Owner/Admin.
     * Fetch the own container and validate that the key IsAdmin is preset and value is set to true
     */
    isOwner() {
        return new Promise(async (resolve) => {
            try {
                const ownContainerHandle = await window.safeApp.getOwnContainer(this.app);
                const entriesHandle = await window.safeMutableData.getEntries(ownContainerHandle);
                const value = await window.safeMutableDataEntries.get(entriesHandle, IS_ADMIN.key);
                window.safeMutableDataEntries.free(entriesHandle);
                window.safeMutableData.free(ownContainerHandle);
                resolve(value.buf.toString() === IS_ADMIN.value);
            } catch (err) {
                resolve(false);
            }
        });
    }

    /**
     * Post comment for the topic
     * @param {CommentModel} commentModel
     */
    postComment(commentModel) {
        return new Promise(async (resolve, reject) => {
            try {
                const updatedList = this.comments.slice(0);
                updatedList.unshift(commentModel);
                const entriesHandle = await window.safeMutableData.getEntries(this.mData);
                const mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
                // If it is the first comment then the key and value is inserted else updated
                if (updatedList.length === 1) {
                    await window.safeMutableDataMutation.insert(mutationHandle, this.topic, JSON.stringify(updatedList));
                } else {
                    const data = await window.safeMutableData.get(this.mData, this.topic);
                    await window.safeMutableDataMutation.update(mutationHandle, this.topic, JSON.stringify(updatedList), data.version + 1);
                }
                // The muatation is saved in the network only when the applyEntriesMutation is called
                await window.safeMutableData.applyEntriesMutation(this.mData, mutationHandle);
                window.safeMutableDataMutation.free(mutationHandle);
                window.safeMutableDataEntries.free(entriesHandle);
                this.comments = updatedList;
                resolve(this.comments);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * List all comments for the topic
     */
    listComments() {
        return new Promise(async (resolve) => {
            try {
                const data = await window.safeMutableData.get(this.mData, this.topic);
                this.comments = [];
                const jsonList = JSON.parse(data.buf.toString());
                for (let i = 0; i < jsonList.length; i++) {
                    this.comments.push(new CommentModel(jsonList[i].name, jsonList[i].message, jsonList[i].date));
                }
                resolve(this.comments);
            } catch (err) {
                console.warn('list comments: ', err);
                resolve(this.comments);
            }
        });
    }

    /**
     * Delete comment for the topic
     * @param {any} commentModel
     */
    deleteComment(commentModel) {
        return new Promise(async (resolve, reject) => {
            try {
                const entriesHandle = await window.safeMutableData.getEntries(this.mData);
                const mutationHandle = await window.safeMutableDataEntries.mutate(entriesHandle);
                const updatedList = this.comments.slice(0);
                updatedList.splice(updatedList.indexOf(commentModel), 1);
                const data = await window.safeMutableData.get(this.mData, this.topic);
                await window.safeMutableDataMutation.update(mutationHandle, this.topic, JSON.stringify(updatedList), data.version + 1);
                await window.safeMutableData.applyEntriesMutation(this.mData, mutationHandle);
                window.safeMutableDataMutation.free(mutationHandle);
                window.safeMutableDataEntries.free(entriesHandle);
                this.comments = updatedList;
                resolve(this.comments);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Reconnect to SAFE Network
     */
    reconnect() {
        return window.safeApp.reconnect();
    }
}
