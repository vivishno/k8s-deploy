"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentTime = exports.getRandomInt = exports.sleep = exports.annotateNamespace = exports.annotateChildPods = exports.getLastSuccessfulRunSha = exports.checkForErrors = exports.isEqual = exports.getExecutableExtension = void 0;
const os = require("os");
const core = require("@actions/core");
const constants = require("../constants");
const githubClient_1 = require("../githubClient");
const httpClient_1 = require("./httpClient");
function getExecutableExtension() {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }
    return '';
}
exports.getExecutableExtension = getExecutableExtension;
function isEqual(str1, str2, ignoreCase) {
    if (str1 == null && str2 == null) {
        return true;
    }
    if (str1 == null || str2 == null) {
        return false;
    }
    if (!!ignoreCase) {
        return str1.toUpperCase() === str2.toUpperCase();
    }
    else {
        return str1 === str2;
    }
}
exports.isEqual = isEqual;
function checkForErrors(execResults, warnIfError) {
    if (execResults.length !== 0) {
        let stderr = '';
        execResults.forEach(result => {
            if (!!result && !!result.stderr) {
                if (result.code !== 0) {
                    stderr += result.stderr + '\n';
                }
                else {
                    core.warning(result.stderr);
                }
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError) {
                core.warning(stderr.trim());
            }
            else {
                throw new Error(stderr.trim());
            }
        }
    }
}
exports.checkForErrors = checkForErrors;
function getLastSuccessfulRunSha(githubToken) {
    return __awaiter(this, void 0, void 0, function* () {
        let lastSuccessRunSha = '';
        const gitHubClient = new githubClient_1.GitHubClient(process.env.GITHUB_REPOSITORY, githubToken);
        const branchTokens = process.env.GITHUB_REF.split('/');
        const response = yield gitHubClient.getSuccessfulRunsOnBranch(branchTokens[branchTokens.length - 1]);
        if (response.statusCode == httpClient_1.StatusCodes.OK
            && response.body
            && response.body.total_count) {
            if (response.body.total_count > 0) {
                lastSuccessRunSha = response.body.workflow_runs[0].head_sha;
            }
            else {
                lastSuccessRunSha = 'NA';
            }
        }
        else if (response.statusCode != httpClient_1.StatusCodes.OK) {
            core.debug(`An error occured while getting succeessful run results. Statuscode: ${response.statusCode}, StatusMessage: ${response.statusMessage}`);
        }
        return lastSuccessRunSha;
    });
}
exports.getLastSuccessfulRunSha = getLastSuccessfulRunSha;
function annotateChildPods(kubectl, resourceType, resourceName, annotationKeyValStr, allPods) {
    const commandExecutionResults = [];
    let owner = resourceName;
    if (resourceType.toLowerCase().indexOf('deployment') > -1) {
        owner = kubectl.getNewReplicaSet(resourceName);
    }
    if (!!allPods && !!allPods.items && allPods.items.length > 0) {
        allPods.items.forEach((pod) => {
            const owners = pod.metadata.ownerReferences;
            if (!!owners) {
                owners.forEach(ownerRef => {
                    if (ownerRef.name === owner) {
                        commandExecutionResults.push(kubectl.annotate('pod', pod.metadata.name, [annotationKeyValStr], true));
                    }
                });
            }
        });
    }
    return commandExecutionResults;
}
exports.annotateChildPods = annotateChildPods;
function annotateNamespace(kubectl, namespaceName, workflowAnnotationsJson) {
    const result = kubectl.getResource('namespace', namespaceName);
    if (!result) {
        return { code: -1, stderr: 'Failed to get resource' };
    }
    else if (!!result && !!result.stderr) {
        return result;
    }
    if (!!result && !!result.stdout) {
        const annotationsSet = JSON.parse(result.stdout).metadata.annotations;
        let annotationKeyValStr = constants.resourceViewAnnotationsKey + '[' + workflowAnnotationsJson + ']';
        if (!!annotationsSet && !!annotationsSet.resourceAnnotations) {
            try {
                if (annotationsSet.resourceAnnotations.startsWith('[') && annotationsSet.resourceAnnotations.endsWith(']')) {
                    let annotationsArr = JSON.parse(annotationsSet.resourceAnnotations.replace(/'/g, '"'));
                    let arrLen = annotationsArr.length;
                    let arrIdx = annotationsArr.findIndex(e => e.repository === process.env['GITHUB_REPOSITORY'] && e.workflow === process.env['GITHUB_WORKFLOW']);
                    if (arrIdx > -1) {
                        annotationsArr.splice(arrIdx, 1);
                    }
                    let annotationsArrStr = JSON.stringify(annotationsArr).replace(/"/g, '\'');
                    if ((arrIdx > -1 && arrLen === 1) || (arrLen === 0)) {
                        annotationsArrStr = [annotationsArrStr.slice(0, 1), workflowAnnotationsJson, annotationsArrStr.slice(1)].join('');
                    }
                    else if ((arrIdx > -1 && arrLen > 1) || (arrLen > 0)) {
                        annotationsArrStr = [annotationsArrStr.slice(0, 1), workflowAnnotationsJson + ',', annotationsArrStr.slice(1)].join('');
                    }
                    annotationKeyValStr = constants.resourceViewAnnotationsKey + annotationsArrStr;
                    return kubectl.annotate('namespace', namespaceName, [annotationKeyValStr], true);
                }
            }
            catch (e) {
                core.debug("Unable to process resource annotations ; Error: " + e);
                return { code: -1, stderr: 'Failed to process namespace annotattions' };
            }
        }
        return kubectl.annotate('namespace', namespaceName, [annotationKeyValStr], true);
    }
}
exports.annotateNamespace = annotateNamespace;
function sleep(timeout) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}
exports.sleep = sleep;
function getRandomInt(max) {
    return Math.floor(Math.random() * Math.floor(max));
}
exports.getRandomInt = getRandomInt;
function getCurrentTime() {
    return new Date().getTime();
}
exports.getCurrentTime = getCurrentTime;
