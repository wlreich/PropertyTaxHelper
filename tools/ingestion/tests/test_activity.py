import sys, tempfile, json, zipfile, unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from activity import observations, extract, digest, price, ValidationError


def prop(**sale_changes):
 sale=dict(saleID=10,deedID=20,pID=100,saleDt='2026-05-27 00:00:00',salePrice=1205000,
           salePriceAdjusted=1205000,confidentialSale=0,reportSupressFromReport=0,multiProperty=0,
           properties='[100]',notes='PRIVATE',financeLoan1AmtFinanced=903750)
 sale.update(sale_changes)
 return dict(pID=100,pYear=2026,sales=[sale],deeds=[dict(deedID=20,pID=100,
     deedDt='2026-05-27 00:00:00',fileDt='2026-05-29',instrumentNum='2026063442',
     deedType='WD',consideration='$903,750',sellerLine='PRIVATE',properties='[100]')])

class ActivityTests(unittest.TestCase):
 def test_allowlist_and_dates(self):
  d,s=observations(prop(),2026,date(2026,8,27))
  self.assertEqual(d['event_date'],'2026-05-27');self.assertEqual(d['filed_date'],'2026-05-29')
  self.assertEqual(s['sale_price'],'1205000');self.assertIsNone(d['sale_price'])
  self.assertNotIn('PRIVATE',json.dumps([d,s]));self.assertNotIn('903750',json.dumps([d,s]))
 def test_missing_zero_and_invalid_prices(self):
  for v in (0,None):self.assertIsNone(price(v))
  for v in (-1,True,'120',float('inf'),1.123):
   with self.assertRaises(ValidationError):price(v)
 def test_quarantine(self):
  for value,reason in [('2026-12-31','future_date'),('2026-02-30','invalid_date')]:
   self.assertEqual(observations(prop(saleDt=value),2026,date(2026,8,27))[1]['quarantine_reason'],reason)
 def test_flags_bundle_and_old_sale(self):
  s=observations(prop(confidentialSale=1,reportSupressFromReport=1,multiProperty=1,properties='[100,101]'),2026,date(2026,8,27))[1]
  self.assertTrue(s['confidential']);self.assertTrue(s['suppressed']);self.assertEqual(s['associated_properties'],['100','101'])
  self.assertEqual(len(observations(prop(saleDt='2007-05-16'),2026,date(2026,8,27))),1)
  self.assertIsNone(observations(prop(confidentialSale=None),2026,date(2026,8,27))[1]['confidential'])
 def test_duplicate_and_wrong_parent(self):
  p=prop();p['sales']*=2
  with self.assertRaises(ValidationError):observations(p,2026,date(2026,8,27))
  with self.assertRaises(ValidationError):observations(prop(pID=101),2026,date(2026,8,27))
 def test_complete_archive_and_failed_scan(self):
  with tempfile.TemporaryDirectory() as tmp:
   tmp=Path(tmp);z=tmp/'source.zip'
   with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED) as f:f.writestr('Travis-protaxExport-20260827.json',json.dumps([prop()]))
   args=(z,'4d284f31-9866-455e-a03f-ffc90bb4ffac',digest(z),2026)
   s=extract(*args,tmp/'ok.jsonl');self.assertEqual(s['observation_count'],2)
   with self.assertRaises(ValidationError):extract(*args,tmp/'ok.jsonl')
   with patch('activity.observations',side_effect=ValidationError('bad stream')):
    with self.assertRaises(ValidationError):extract(*args,tmp/'bad.jsonl')
   self.assertFalse((tmp/'bad.jsonl').exists());self.assertFalse((tmp/'bad.summary.json').exists())
   with self.assertRaises(ValidationError):extract(z,args[1],'0'*64,2026,tmp/'hash.jsonl')

if __name__=='__main__':unittest.main()
