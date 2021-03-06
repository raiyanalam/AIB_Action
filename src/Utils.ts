"use strict";
import stream = require('stream');
import * as os from 'os';

export const TEMP_DIRECTORY: string = process.env.RUNNER_TEMP || os.tmpdir();

export default class Utils
{
    public static IsEqual(a: string, b: string): boolean
    {
        return a.toLowerCase() == b.toLowerCase()
    }
}

export const getCurrentTime = (): string => {
    return new Date().getTime().toString();
}

export class NullOutstreamStringWritable extends stream.Writable {

    constructor(options: any) {
        super(options);
    }

    _write(data: any, encoding: string, callback: Function): void {
        if (callback) {
            callback();
        }
    }
};