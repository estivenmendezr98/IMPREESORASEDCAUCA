
async function testApi() {
    try {
        const response = await fetch("http://localhost:3000/api/reports/detailed-monthly?startDate=2019-01-01T00:00:00.000Z&endDate=2026-12-31T23:59:59.999Z");
        if (!response.ok) {
            console.error('Error status:', response.status);
            const text = await response.text();
            console.error('Error text:', text);
            return;
        }
        const data = await response.json();
        console.log(JSON.stringify(data.slice(0, 3), null, 2)); // Show first 3 items
    } catch (err) {
        console.error(err);
    }
}

testApi();
