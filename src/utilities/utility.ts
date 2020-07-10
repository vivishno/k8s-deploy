import * as os from 'os';
import * as core from '@actions/core';
import { IExecSyncResult } from './tool-runner';
import { Kubectl } from '../kubectl-object-model';
import * as constants from '../constants';

export function getExecutableExtension(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

    return '';
}

export function isEqual(str1: string, str2: string, ignoreCase?: boolean): boolean {
    if (str1 == null && str2 == null) {
        return true;
    }

    if (str1 == null || str2 == null) {
        return false;
    }

    if (!!ignoreCase) {
        return str1.toUpperCase() === str2.toUpperCase();
    } else {
        return str1 === str2;
    }
}

export function checkForErrors(execResults: IExecSyncResult[], warnIfError?: boolean) {
    if (execResults.length !== 0) {
        let stderr = '';
        execResults.forEach(result => {
            if (!!result && !!result.stderr) {
                if (result.code !== 0) {
                    stderr += result.stderr + '\n';
                } else {
                    core.warning(result.stderr);
                }
            }
        });
        if (stderr.length > 0) {
            if (!!warnIfError) {
                core.warning(stderr.trim());
            } else {
                throw new Error(stderr.trim());
            }
        }
    }
}

export function annotateChildPods(kubectl: Kubectl, resourceType: string, resourceName: string, allPods): IExecSyncResult[] {
    const commandExecutionResults = [];
    let annotationKeyValStr = constants.resourceViewAnnotationsKey + '[' + constants.workflowAnnotationsJson + ']';
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

export function annotateNamespace(kubectl: Kubectl, namespaceName: string): IExecSyncResult {
    const result = kubectl.getResource('namespace', namespaceName);
    if (!result) {
        return { code: -1, stderr: 'Failed to get resource' } as IExecSyncResult;
    }
    else if (!!result && !!result.stderr) {
        return result;
    }

    if (!!result && !!result.stdout) {
        const annotationsSet = JSON.parse(result.stdout).metadata.annotations;
        let annotationKeyValStr = constants.resourceViewAnnotationsKey + '[' + constants.workflowAnnotationsJson + ']';
        if (!!annotationsSet && !!annotationsSet.resourceAnnotations) {
            try {
                if (annotationsSet.resourceAnnotations.startsWith('[')) {
                    let annotationsArr = JSON.parse(annotationsSet.resourceAnnotations.replace(/'/g, '"'));
                    let arrIdx = annotationsArr.findIndex(e => e.repository === process.env['GITHUB_REPOSITORY'] && e.workflow === process.env['GITHUB_WORKFLOW']);
                    if (arrIdx > -1) {
                        annotationsArr.splice(arrIdx, 1);
                    }
                    let annotationsArrStr = JSON.stringify(annotationsArr).replace(/"/g, '\'');
                    if (annotationsArrStr.startsWith('[')) {
                        annotationsArrStr = [annotationsArrStr.slice(0, 1), constants.workflowAnnotationsJson + ',', annotationsArrStr.slice(1)].join('');
                    }
                    annotationKeyValStr = constants.resourceViewAnnotationsKey + annotationsArrStr;
                    return kubectl.annotate('namespace', namespaceName, [annotationKeyValStr], true);
                }
            } catch (e) {
                core.debug("Unable to process resource annotations ; Error: " + e);
                return { code: -1, stderr: 'Failed to process namespace annotattions' } as IExecSyncResult;
            }
        }
        return kubectl.annotate('namespace', namespaceName, [annotationKeyValStr], true);
    }
}

export function sleep(timeout: number) {
    return new Promise(resolve => setTimeout(resolve, timeout));
}

export function getRandomInt(max: number) {
    return Math.floor(Math.random() * Math.floor(max));
}

export function getCurrentTime(): number {
    return new Date().getTime();
}
