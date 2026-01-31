import { ApifyClient } from 'apify-client';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: './apify-scraper/.env.local' });
// Initialize the ApifyClient with API token (from env or replace with your token)
const token = process.env.APIFY_TOKEN;
const client = new ApifyClient({ token });

const data = fs.readFileSync('instagram_profiles.json', 'utf8');
const profiles = JSON.parse(data);

console.log(profiles);

// Prepare Actor input
const input = {
    "username": profiles,
    "resultsLimit": 2,
    "skipPinnedPosts": true,
    "onlyPostsNewerThan": "1 day"
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("nH2AHrwxeTRJoN5hX").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
    
    // Save the results to a JSON file
    const outputPath = './results.json';
    fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(`Results saved to ${outputPath}`);
})();