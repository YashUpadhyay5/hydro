const { Sequelize } = require('sequelize');
const sequelize = require('./src/config/database');
const Media = require('./src/shared/models/Media');
const Cluster = require('./src/shared/models/Cluster');
const ClusterSetting = require('./src/shared/models/ClusterSetting');
const { getDistance } = require('./src/core/utils/siteCache');

async function run() {
    await sequelize.authenticate();
    console.log('Connected to DB');

    const unassignedMedia = await Media.findAll({ where: { clusterId: null } });
    console.log(`Found ${unassignedMedia.length} unassigned media items.`);

    let setting = await ClusterSetting.findByPk(1);
    const radiusThreshold = setting ? setting.clusterRadius : 500;
    const GPS_BUFFER = 20;

    let updatedCount = 0;

    for (const media of unassignedMedia) {
        if (!media.latitude || !media.longitude) continue;

        const latNum = parseFloat(media.latitude);
        const lonNum = parseFloat(media.longitude);

        let clusters = await Cluster.findAll();
        let matchedCluster = null;
        let minDistance = Infinity;

        for (const cl of clusters) {
            const dist = getDistance(latNum, lonNum, cl.centerLatitude, cl.centerLongitude);
            if (dist <= (radiusThreshold + GPS_BUFFER)) {
                if (dist < minDistance) {
                    minDistance = dist;
                    matchedCluster = cl;
                }
            }
        }

        if (matchedCluster) {
            media.clusterId = matchedCluster.id;
            
            const siblings = await Media.findAll({ where: { clusterId: matchedCluster.id } });
            const lats = [...siblings.map(s => s.latitude), latNum].filter(l => l !== null);
            const lons = [...siblings.map(s => s.longitude), lonNum].filter(l => l !== null);
            
            matchedCluster.centerLatitude = lats.reduce((a, b) => a + b, 0) / lats.length;
            matchedCluster.centerLongitude = lons.reduce((a, b) => a + b, 0) / lons.length;
            await matchedCluster.save();
        } else {
            const count = await Cluster.count();
            let clusterName = `Cluster #${count + 1}`;
            if (media.address) {
                const parts = media.address.split(',').map(p => p.trim()).filter(Boolean);
                if (parts.length > 0) {
                    const firstPart = parts[0];
                    const hasPlus = firstPart.includes('+');
                    const isShortNumeric = /^\d+[\d\/\-\s]*$/.test(firstPart);
                    if ((hasPlus || isShortNumeric) && parts.length > 1) {
                        clusterName = parts.slice(1, 3).join(', ');
                    } else {
                        clusterName = parts.slice(0, 2).join(', ');
                    }
                }
            }

            const newCluster = await Cluster.create({
                name: clusterName,
                centerLatitude: latNum,
                centerLongitude: lonNum,
                radius: radiusThreshold
            });
            media.clusterId = newCluster.id;
        }

        await media.save();
        updatedCount++;
    }

    console.log(`Successfully clustered ${updatedCount} media items.`);
    process.exit(0);
}

run().catch(console.error);
