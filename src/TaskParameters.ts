"use strict";
import path = require("path");
import * as tl from '@actions/core';
import * as constants from "./constants";
import Utils from "./Utils";
var fs = require('fs');

export default class TaskParameters {
    // image builder inputs
    public resourceGroupName: string;
    public location: string = "";
    public imagebuilderTemplateName: string;
    public isTemplateJsonProvided: boolean = false;
    public templateJsonFromUser: string = '';
    public nowaitMode: string;
    public buildTimeoutInMinutes: number = 80;
    public vmSize: string = "";

    // source
    public sourceImageType: string;
    public sourceOSType: string;
    public sourceResourceId: string = "";
    public imageVersionId: string = "";
    public baseImageVersion: string = "";
    public imagePublisher: string = "";
    public imageOffer: string = "";
    public imageSku: string = "";

    //customize
    public buildPath: string;
    public buildFolder: string;
    public blobName: string = "";
    public inlineScript: string;
    public provisioner: string = "";
    public windowsUpdateProvisioner: boolean;
    //??
    public storageAccountName: string = "";

    public customizerSource: string = "";
    public customizerDestination: string = "";
    public customizerScript: string = "";
    public customizerWindowsUpdate: string = "";

    //distribute
    public distributeType: string;
    public imageIdForDistribute: string = "";
    public replicationRegions: string = "";
    public managedImageLocation: string = "";
    public galleryImageId: string = "";
    public runOutputName: string;

    constructor() {
        var locations = ["eastus", "eastus2", "westcentralus", "westus", "westus2", "northeurope", "westeurope"];
        // general inputs
        console.log("start reading task parameters...");
        this.location = tl.getInput(constants.Location, { required: true });

        if (!(locations.indexOf(this.location.toString().replace(/\s/g, "").toLowerCase()) > -1)) {
            throw new Error("location not from available regions or it is not defined");
        }
        this.resourceGroupName = tl.getInput(constants.ResourceGroupName);
        this.imagebuilderTemplateName = tl.getInput(constants.ImageBuilderTemplateName);
        if (this.imagebuilderTemplateName.indexOf("json") > -1) {
            this.isTemplateJsonProvided = true;
            var data = fs.readFileSync(this.imagebuilderTemplateName, 'utf8');
            this.templateJsonFromUser = JSON.parse(JSON.stringify(data));
            console.log(this.templateJsonFromUser);
        }
        this.nowaitMode = tl.getInput(constants.NoWaitMode);
        this.buildTimeoutInMinutes = parseInt(tl.getInput(constants.BuildTimeoutInMinutes));
        //vm size
        this.vmSize = tl.getInput(constants.VMSize);

        //source inputs
        this.sourceImageType = tl.getInput(constants.SourceImageType);
        this.sourceOSType = tl.getInput(constants.SourceOSType, { required: true });
        const sourceImage = tl.getInput(constants.SourceImage, { required: true });

        if (Utils.IsEqual(this.sourceImageType, constants.marketPlaceSourceTypeImage) || Utils.IsEqual(this.sourceImageType, constants.platformImageSourceTypeImage)) {
            this.sourceImageType = constants.marketPlaceSourceTypeImage;
            this._extractImageDetails(sourceImage);
        }
        else if (Utils.IsEqual(this.sourceImageType, constants.managedImageSourceTypeImage)) {
            this.sourceResourceId = sourceImage;
        }
        else {
            this.imageVersionId = sourceImage;
        }

        //customize inputs
        var bp = tl.getInput(constants.CustomizerSource).toString();
        var x = bp.split(path.sep);
        this.buildFolder = x[x.length - 1];
        this.buildPath = path.normalize(bp.trim());
        this.customizerDestination = tl.getInput(constants.customizerDestination);
        if (this.customizerDestination == null || this.customizerDestination == undefined || this.customizerDestination.length == 0) {
            this.customizerDestination = this.sourceOSType;
        }
        if (Utils.IsEqual(this.customizerDestination, "windows")) {
            this.provisioner = "powershell";
        }
        else {
            this.provisioner = "shell";
        }
        this.inlineScript = tl.getInput(constants.customizerScript);
        if (tl.getInput(constants.customizerWindowsUpdate) == "true") {
            this.windowsUpdateProvisioner = true;
        }
        else {
            this.windowsUpdateProvisioner = false;
        }

        //distribute inputs
        this.distributeType = tl.getInput(constants.DistributeType);
        const distResourceId = tl.getInput(constants.DistResourceId);
        const distLocation = tl.getInput(constants.DistLocation);
        if (Utils.IsEqual(this.distributeType, constants.managedImageSourceTypeImage)) {
            this.imageIdForDistribute = distResourceId;
            this.managedImageLocation = distLocation;
        }
        else if (Utils.IsEqual(this.distributeType, constants.sharedImageGallerySourceTypeImage)) {
            this.galleryImageId = distResourceId;
            this.replicationRegions = distLocation;
        }
        this.runOutputName = tl.getInput(constants.RunOutputName);

        console.log("end reading parameters")
    }

    private _extractImageDetails(img: string) {
        this.imagePublisher = "";
        this.imageOffer = "";
        this.imageSku = "";
        this.baseImageVersion
        var parts = img.split(':');
        if (parts.length != 4) {
            throw Error("Platform Base Image should have '{publisher}:{offer}:{sku}:{version}'. All fields are required.")
        }
        this.imagePublisher = parts[0];
        this.imageOffer = parts[1];
        this.imageSku = parts[2];
        this.baseImageVersion = parts[3];
    }
}