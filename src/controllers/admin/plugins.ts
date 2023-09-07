
// Credit for some typescript line translations and explanation of code: chatGPT
// Translating import statements to typescript

import nconf from 'nconf';
import winston from 'winston';


// Importing Request and Response Types from Express
import { Request, Response } from 'express';

import plugins from '../../plugins';
import meta from '../../meta';

async function getPlugins(matching: boolean) {
    try {
        const pluginsData: pluginTemplate[] = await plugins.list(matching) as pluginTemplate[];
        return pluginsData || [];
    } catch (err: unknown) { // Specify the type as unknown
        if (err instanceof Error) {
            // Handle the error if it's an instance of Error
            winston.error(err.stack);
        }
        return [];
    }
}

async function getCompatiblePlugins(): Promise<pluginTemplate[]> {
    return await getPlugins(true);
}

async function getAllPlugins(): Promise<pluginTemplate[]> {
    return await getPlugins(false);
}

async function getListTrending(): Promise<Record<string, number>[]> {
    return await plugins.listTrending() as Record<string, number>[];
}

function getVersion(): string {
    const version: string = nconf.get('version') as string;
    return version;
}

function getSubmitPluginUsage(): number {
    const mc: metaConfigTemplate = meta.config as metaConfigTemplate;
    return mc.submitPluginUsage;
}

// Creating the meta.config type
interface metaConfigTemplate {
    submitPluginUsage: number
}

// Creating the plugin type
interface pluginTemplate {
    id: string
    downloads: number
    installed: boolean
    outdated: boolean
    active: boolean
    name: string
}

// Creating the pkgData type
interface pkgDataTemplate {
    name: string
}

// Creating the pluginController type
interface pluginControllerTemplate {
    get: (req: Request, res: Response<object>) => Promise<void>;
}

const pluginsController: pluginControllerTemplate = {
    async get(req: Request, res: Response<object>) {
        const [
            compatible,
            all,
            trending,
        ]: [pluginTemplate[], pluginTemplate[], Record<string, number>[]] = await Promise.all([
            getCompatiblePlugins(),
            getAllPlugins(),
            getListTrending(),
        ]);

        // Assigning pkgData a type of pkgDataTemplate
        // Assigning plugin a type of pluginTemplate
        const compatiblePkgNames = compatible.map((pkgData: pkgDataTemplate) => pkgData.name);
        const installedPlugins = compatible.filter((plugin: pluginTemplate) => plugin && plugin.installed);
        const activePlugins = all.filter((plugin: pluginTemplate) => plugin && plugin.installed && plugin.active);

        // Assigning trendingScores a type of Record<string, number>
        // Assigning memo a type of Record<string, number>
        // Assigning cur a type of Record<string, number>
        const trendingScores: Record<string, number> =
            trending.reduce((memo: Record<string, number>, cur: Record<string, number>) => {
                memo[cur.label] = cur.value;
                return memo;
            }, {});

        // Assigning trendingPlugins the type of pluginTemplate[]
        const trendingPlugins: pluginTemplate[] = all
            .filter((plugin: pluginTemplate) => plugin && Object.keys(trendingScores).includes(plugin.id))
            .sort((a: pluginTemplate, b: pluginTemplate) => trendingScores[b.id] - trendingScores[a.id])
            .map((plugin: pluginTemplate) => {
                plugin.downloads = trendingScores[plugin.id];
                return plugin;
            });

        res.render('admin/extend/plugins', {
            installed: installedPlugins,
            installedCount: installedPlugins.length,
            activeCount: activePlugins.length,
            inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
            canChangeState: !nconf.get('plugins:active'),
            upgradeCount: compatible.reduce((count: number, current: pluginTemplate) => {
                if (current.installed && current.outdated) {
                    count += 1;
                }
                return count;
            }, 0),
            download: compatible.filter((plugin: pluginTemplate) => !plugin.installed),
            incompatible: all.filter((plugin: pluginTemplate) => !compatiblePkgNames.includes(plugin.name)),
            trending: trendingPlugins,
            submitPluginUsage: getSubmitPluginUsage(),
            version: getVersion(),
        });
    },
};

export = pluginsController;
