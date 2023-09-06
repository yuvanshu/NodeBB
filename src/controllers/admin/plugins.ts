import * as nconf from 'nconf';
import * as winston from 'winston';
import * as plugins from '../../plugins';
import * as meta from '../../meta';

const pluginsController: any = {};

// The next line calls a function in a module that has not been updated to TS yet
// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
pluginsController.get = async function (req: any, res: any) {
    const [compatible, all, trending] = await Promise.all([
        getCompatiblePlugins(),
        getAllPlugins(),
        plugins.listTrending(),
    ]);

    const compatiblePkgNames = compatible.map((pkgData: any) => pkgData.name);
    const installedPlugins = compatible.filter((plugin: any) => plugin && plugin.installed);
    const activePlugins = all.filter((plugin: any) => plugin && plugin.installed && plugin.active);

    const trendingScores: Record<string, number> = trending.reduce((memo: Record<string, number>, cur: any) => {
        memo[cur.label] = cur.value;
        return memo;
    }, {});
    const trendingPlugins = all
        .filter((plugin: any) => plugin && Object.keys(trendingScores).includes(plugin.id))
        .sort((a: any, b: any) => trendingScores[b.id] - trendingScores[a.id])
        .map((plugin: any) => {
            plugin.downloads = trendingScores[plugin.id];
            return plugin;
        });

    res.render('admin/extend/plugins', {
        installed: installedPlugins,
        installedCount: installedPlugins.length,
        activeCount: activePlugins.length,
        inactiveCount: Math.max(0, installedPlugins.length - activePlugins.length),
        canChangeState: !nconf.get('plugins:active'),
        upgradeCount: compatible.reduce((count: number, current: any) => {
            if (current.installed && current.outdated) {
                count += 1;
            }
            return count;
        }, 0),
        download: compatible.filter((plugin: any) => !plugin.installed),
        incompatible: all.filter((plugin: any) => !compatiblePkgNames.includes(plugin.name)),
        trending: trendingPlugins,
        submitPluginUsage: meta.config.submitPluginUsage,
        version: nconf.get('version'),
    });
};

async function getCompatiblePlugins() {
    return await getPlugins(true);
}

async function getAllPlugins() {
    return await getPlugins(false);
}

async function getPlugins(matching: boolean) {
    try {
        const pluginsData = await plugins.list(matching);
        return pluginsData || [];
    } catch (err) {
        winston.error(err.stack);
        return [];
    }
}

export = pluginsController;
