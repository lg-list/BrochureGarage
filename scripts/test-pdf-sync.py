"""Offline regression tests for parsing and append-only sync boundaries."""

import importlib.util
from pathlib import Path
import unittest
from unittest.mock import Mock, patch
from tempfile import TemporaryDirectory
import json

spec = importlib.util.spec_from_file_location("sync", Path(__file__).with_name("sync-auto-brochures.py"))
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class ParseTests(unittest.TestCase):
    def test_titles_sections_entities_and_encoded_paths(self):
        html = '''<h3>Honda CR-V</h3>
        2018 Honda CR-V PDF Brochure <a href="http://www.auto-brochures.com/makes/Honda/CR-V/Honda_US CR-V_2018.pdf"> (11.8 MB)</a><br>
        2017 <b>Honda CR-V</b> PDF Brochure <a href="makes/Honda/CR-V/Honda_US%20CR-V_2017.pdf">(5.4 MB)</a><br>
        <h3>Honda Accord &amp; Hybrid</h3>
        2016 Honda Accord PDF Brochure <a href="makes/Honda/Accord/Honda_2016.pdf">(1.0 MB)</a>'''
        source = {"name": "Honda", "brand": "honda", "page": sync.SOURCE + "honda.html"}
        rows, errors = sync.parse_entries(sync.BeautifulSoup(html, "html.parser"), source)
        self.assertEqual(errors, [])
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["file"], "CR-V/Honda_US CR-V_2018.pdf")
        self.assertEqual(rows[1]["title"], "2017 Honda CR-V PDF Brochure")
        self.assertEqual(rows[2]["section"], "Honda Accord & Hybrid")
        self.assertTrue(rows[0]["sourceUrl"].startswith("https://"))
        self.assertIn("%20", rows[0]["sourceUrl"])

    def test_brand_diacritics(self):
        self.assertEqual(sync.slug("Citro\u00ebn"), "citroen")
        self.assertEqual(sync.slug("Land Rover/Range Rover"), "land-rover")

    def test_malformed_source_href_and_size(self):
        url = sync.secure_source_url("http://www.auto-brochures.com/BMW Serie 3 Cabrio (1987) GER makes/BMW/3 Series/wagon.pdf", sync.SOURCE)
        self.assertEqual(sync.safe_file(url), "3 Series/wagon.pdf")
        html = '<h3>Volvo S40</h3>2011 Volvo S40 PDF Brochure <a href="makes/Volvo/S40/test.pdf">(2.1)</a>'
        rows, errors = sync.parse_entries(sync.BeautifulSoup(html, "html.parser"), {"brand": "volvo", "name": "Volvo", "page": sync.SOURCE})
        self.assertEqual(errors, [])
        self.assertEqual(rows[0]["size"], "2.1")

    def test_file_collision_and_traversal(self):
        self.assertEqual(sync.safe_file(sync.SOURCE + "makes/Other/Model/a:b.pdf"), "Model/a-b.pdf")
        with self.assertRaises(ValueError):
            sync.safe_file(sync.SOURCE + "makes/Honda/../secret.pdf")
        with self.assertRaises(ValueError):
            sync.secure_source_url("https://other.example/file.pdf", sync.SOURCE)
        with self.assertRaises(ValueError):
            sync.local_path({"brand": "honda", "file": "../../../secret.pdf"})

    def test_duplicate_source_links(self):
        html = '<h3>Test</h3>2016 Test PDF <a href="makes/Test/test.pdf">(1 MB)</a><br>2016 Test PDF <a href="makes/Test/test.pdf">(1 MB)</a>'
        rows, errors = sync.parse_entries(sync.BeautifulSoup(html, "html.parser"), {"brand": "test", "name": "Test", "page": sync.SOURCE})
        self.assertEqual(len(rows), 1)
        self.assertEqual(errors, [])

    def test_equivalent_choice_never_changes_year_or_model(self):
        html = '<title>300 Multiple Choices</title><a href="/makes/BMW/BMW_US%20Full_Line_2019.pdf">same</a><a href="/makes/BMW/BMW_US%20Full%20Line_2011.pdf">wrong year</a>'
        url = sync.SOURCE + 'makes/BMW/BMW_US%20Full%20Line_2019.pdf'
        self.assertEqual(sync.equivalent_source_choice({'title':'2019 BMW Model Range PDF'}, html, url), sync.SOURCE + 'makes/BMW/BMW_US%20Full_Line_2019.pdf')
        wrong = '<title>300 Multiple Choices</title><a href="/makes/BMW/BMW_US%20Full%20Line_2018.pdf">wrong year</a>'
        self.assertIsNone(sync.equivalent_source_choice({'title':'2019 BMW Model Range PDF'}, wrong, url))

    def test_existing_object_is_never_uploaded_again(self):
        client = Mock()
        client.head_object.return_value = {'ContentLength': 5000}
        with patch.object(sync, 'public_check', return_value='https://public.example/file.pdf'), patch.object(sync, 'download') as download:
            result = sync.sync_one(client, {'key':'pdfs/test/test.pdf'})
        self.assertEqual(result['status'], 'existing')
        download.assert_not_called()
        client.put_object.assert_not_called()

    def test_small_upload_is_conditional(self):
        client = Mock()
        with TemporaryDirectory() as folder:
            path = Path(folder)/'test.pdf'
            path.write_bytes(b'%PDF-test')
            sync.upload_new(client, 'pdfs/test/test.pdf', path, {'bytes':9,'sha256':'testhash'})
        self.assertEqual(client.put_object.call_args.kwargs['IfNoneMatch'], '*')
        self.assertEqual(client.put_object.call_args.kwargs['ContentType'], 'application/pdf')

    def test_failed_public_validation_does_not_change_catalog(self):
        catalog = {'test':[{'title':'2016 Existing','file':'existing.pdf','size':'1 MB','section':'Test'}]}
        with TemporaryDirectory() as folder:
            root = Path(folder)
            sync.save_json(root/'data/brochures.json',catalog)
            plan = {'scope':'existing','parserErrors':[],'sourceBrands':1,'sourceRecords':2,'excludedOlderRecords':0,
                    'candidates':[{'brand':'test','key':'pdfs/test/new.pdf','title':'2017 New','sourceUrl':sync.SOURCE+'makes/Test/new.pdf'}]}
            with patch.object(sync,'ROOT',root), patch.object(sync,'sync_one',side_effect=ValueError('Invalid public PDF')):
                with self.assertRaises(SystemExit): sync.apply_plan(Mock(),plan,1)
            self.assertEqual(sync.read_json(root/'data/brochures.json'),catalog)
            self.assertEqual(len(sync.read_json(root/'seo/pdf-sync-results.json')['failures']),1)


if __name__ == "__main__":
    unittest.main()
