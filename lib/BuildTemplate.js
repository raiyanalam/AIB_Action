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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const Utils_1 = __importDefault(require("./Utils"));
const AzureRestClient_1 = require("azure-actions-webclient/AzureRestClient");
var defaultTemplate = `
{
    "location": "",
    "identity": {
        "type": "UserAssigned",
          "userAssignedIdentities": {
            "IDENTITY": {}
          }
    },
    "properties": {
      "source": SOURCE,
      "customize": [CUSTOMIZE],
      "distribute": [DISTRIBUTE],
      "vmProfile": {
        "vmSize": "Standard_D1_v2",
        "osDiskSizeGB": 136 
        }
    }
  }
`;
var templateSource = new Map([
    ["managedimage", `{"type": "ManagedImage", "imageId": "IMAGE_ID"}`],
    ["sharedgalleryimage", `{"type": "SharedImageVersion", "imageVersionId": "IMAGE_ID"}`],
    ["marketplace", `{"type": "PlatformImage", "publisher": "PUBLISHER_NAME", "offer": "OFFER_NAME","sku": "SKU_NAME", "version": "VERSION"}`]
]);
var templateCustomizer = new Map([
    ["shell", `{"type": "File", "name": "vststask_file_copy", "sourceUri": "", "destination": ""},{"type": "Shell", "name": "vststask_inline", "inline":[]}`],
    ["powershell", `{"type": "PowerShell", "name": "vststask_inline", "inline":[]}`],
    ["windowsUpdate", `{"type": "PowerShell", "name": "5minWait_is_needed_before_windowsUpdate", "inline":["Start-Sleep -Seconds 300"]},{"type": "WindowsUpdate", "searchCriteria": "IsInstalled=0", "filters": ["exclude:$_.Title -like '*Preview*'", "include:$true"]}`]
]);
var templateDistribute = new Map([
    ["managedimage", `{"type": "ManagedImage", "imageId": "IMAGE_ID", "location": "", "runOutputName": "ManagedImage_distribute"}`],
    ["sharedgalleryimage", `{"type": "SharedImage", "galleryImageId": "IMAGE_ID", "replicationRegions": [], "runOutputName": "SharedImage_distribute"}`],
    ["vhd", `{"type": "VHD", "runOutputName": "VHD_distribute"}`]
]);
class BuildTemplate {
    constructor(resourceAuthorizer, taskParameters) {
        try {
            this._taskParameters = taskParameters;
            console.log("Reached here");
            this._client = new AzureRestClient_1.ServiceClient(resourceAuthorizer);
            console.log("Did not reach here");
        }
        catch (error) {
            throw Error(error);
        }
    }
    getLatestVersion(subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            let httpRequest = {
                method: 'GET',
                uri: this._client.getRequestUri(`/subscriptions/{subscriptionId}/providers/Microsoft.Compute/locations/{location}/publishers/{publisherName}/artifacttypes/vmimage/offers/{offer}/skus/{skus}/versions`, { '{subscriptionId}': subscriptionId, '{location}': this._taskParameters.location, '{publisherName}': this._taskParameters.imagePublisher, '{offer}': this._taskParameters.imageOffer, '{skus}': this._taskParameters.imageSku }, ["$orderby=name%20desc", "$top=1"], '2018-06-01')
            };
            var latestVersion = "";
            try {
                var response = yield this._client.beginRequest(httpRequest);
                if (response.statusCode != 200 || response.body.statusCode == "Failed") {
                    throw Error(response.statusCode.toString());
                }
                if (response.statusCode == 200 && response.body)
                    latestVersion = response.body[0].name;
            }
            catch (error) {
                throw Error(`failed to get latest image version: request uri ${httpRequest.uri}: ${error}`);
            }
            return latestVersion;
        });
    }
    getTemplate(blobUrl, imgBuilderId, subscriptionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var template = defaultTemplate;
            template = template.replace("IDENTITY", imgBuilderId);
            template = template.replace("VM_SIZE", this._taskParameters.vmSize);
            template = template.replace("SOURCE", templateSource.get(this._taskParameters.sourceImageType.toLowerCase()));
            template = template.replace("DISTRIBUTE", templateDistribute.get(this._taskParameters.distributeType.toLowerCase()));
            var customizers = templateCustomizer.get(this._taskParameters.provisioner);
            if (Utils_1.default.IsEqual(this._taskParameters.provisioner, "powershell") && this._taskParameters.windowsUpdateProvisioner)
                customizers = customizers + "," + templateCustomizer.get("windowsUpdate");
            template = template.replace("CUSTOMIZE", customizers);
            var templateJson = JSON.parse(template);
            templateJson.location = this._taskParameters.location;
            if (Utils_1.default.IsEqual(templateJson.properties.source.type, "PlatformImage")) {
                templateJson.properties.source.publisher = this._taskParameters.imagePublisher;
                templateJson.properties.source.offer = this._taskParameters.imageOffer;
                templateJson.properties.source.sku = this._taskParameters.imageSku;
                if (Utils_1.default.IsEqual(this._taskParameters.baseImageVersion, "latest"))
                    templateJson.properties.source.version = yield this.getLatestVersion(subscriptionId);
                else
                    templateJson.properties.source.version = this._taskParameters.baseImageVersion;
            }
            else if (Utils_1.default.IsEqual(templateJson.properties.source.type, "ManagedImage"))
                templateJson.properties.source.imageId = this._taskParameters.sourceResourceId;
            else
                templateJson.properties.source.imageVersionId = this._taskParameters.imageVersionId;
            // customize
            if (Utils_1.default.IsEqual(this._taskParameters.provisioner, "shell")) {
                var inline = "#\n";
                var packageName = `/tmp/${this._taskParameters.buildFolder}`;
                templateJson.properties.customize[0].sourceUri = blobUrl;
                templateJson.properties.customize[0].destination = `${packageName}.tar.gz`;
                inline += `mkdir -p ${packageName}\n`;
                inline += `sudo tar -xzvf ${templateJson.properties.customize[0].destination} -C ${packageName}\n`;
                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                templateJson.properties.customize[1].inline = inline.split("\n");
            }
            else if (Utils_1.default.IsEqual(this._taskParameters.provisioner, "powershell")) {
                var packageName = "c:\\buildartifacts\\" + this._taskParameters.buildFolder;
                // create buildartifacts folder
                var inline = `New-item -Path c:\\buildartifacts -itemtype directory\n`;
                // download zip
                inline += `Invoke-WebRequest -Uri '${blobUrl}' -OutFile ${packageName}.zip -UseBasicParsing\n`;
                // unzip
                inline += `Expand-Archive -Path ${packageName}.zip -DestinationPath ${packageName}\n`;
                if (this._taskParameters.inlineScript)
                    inline += `${this._taskParameters.inlineScript}\n`;
                templateJson.properties.customize[0].inline = inline.split("\n");
            }
            if (Utils_1.default.IsEqual(templateJson.properties.distribute[0].type, "ManagedImage")) {
                templateJson.properties.distribute[0].imageId = this._taskParameters.imageIdForDistribute;
                templateJson.properties.distribute[0].location = this._taskParameters.managedImageLocation;
            }
            if (Utils_1.default.IsEqual(templateJson.properties.distribute[0].type, "SharedImage")) {
                templateJson.properties.distribute[0].galleryImageId = this._taskParameters.galleryImageId;
                var regions = this._taskParameters.replicationRegions.split(",");
                templateJson.properties.distribute[0].replicationRegions = regions;
            }
            return templateJson;
        });
    }
}
exports.default = BuildTemplate;
