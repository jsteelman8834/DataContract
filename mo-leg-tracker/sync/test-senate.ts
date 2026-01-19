import { fetchSenateBillDetail } from './sources/senate-scraper';

async function test() {
  console.log('Testing Senate bill detail fetch for SB 847...');
  try {
    const detail = await fetchSenateBillDetail('SB', 847);
    if (detail) {
      console.log('Title:', detail.title || '(empty)');
      console.log('Brief:', detail.briefDescription?.substring(0, 80) + '...' || '(empty)');
      console.log('Status:', detail.currentStatus);
      console.log('Committee:', detail.currentCommittee || '(none)');
      console.log('LR Number:', detail.lrNumber || '(empty)');
      console.log('Sponsor:', detail.sponsor ? JSON.stringify(detail.sponsor) : '(none)');
      console.log('Last Action Date:', detail.lastActionDate || '(none)');
      console.log('SenateBillId:', detail.senateBillId || '(empty)');
    } else {
      console.log('No detail returned');
    }
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

test();
