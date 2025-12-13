import { Storage } from '@google-cloud/storage';

// Use default application credentials or OAuth
const storage = new Storage({
    projectId: 'gen-lang-client-0040772112',
});

async function createBucket() {
    const bucketName = 'video-pipeline-assets';
    
    try {
        // Check if bucket exists
        const [exists] = await storage.bucket(bucketName).exists();
        
        if (exists) {
            console.log(`✓ Bucket ${bucketName} already exists`);
            return true;
        }
        
        // Create bucket
        await storage.createBucket(bucketName, {
            location: 'US',
            storageClass: 'STANDARD',
        });
        
        console.log(`✓ Bucket ${bucketName} created successfully`);
        return true;
    } catch (error: any) {
        console.error('Error:', error.message);
        return false;
    }
}

createBucket().then(success => process.exit(success ? 0 : 1));
