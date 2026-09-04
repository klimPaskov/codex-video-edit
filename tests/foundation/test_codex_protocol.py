import copy
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'scripts'))
from verify_codex_protocol import METHODS, inspect_requests, resolve_local


def fixture():
    document = {'oneOf': [], 'definitions': {}}
    for index, method in enumerate(METHODS):
        key = f'Params{index}'
        document['definitions'][key] = {'type': 'object', 'properties': {'test': {'type': 'string'}}}
        document['oneOf'].append({'required': ['id', 'method', 'params'], 'properties': {
            'method': {'enum': [method]}, 'params': {'$ref': f'#/definitions/{key}'}}})
    document['definitions']['Params6'] = {'oneOf': [
        {'required': ['type'], 'properties': {'type': {'enum': ['chatgpt']}}}]}
    return document


class CodexProtocolTests(unittest.TestCase):
    def test_resolves_parameter_shapes_and_managed_login(self):
        result = inspect_requests(fixture())
        self.assertEqual(set(result), set(METHODS))
        self.assertEqual(result['account/login/start']['chatgpt_properties'], ['type'])

    def test_missing_method_is_not_satisfied_by_description_text(self):
        document = fixture()
        document['oneOf'].pop(0)
        document['description'] = 'initialize'
        with self.assertRaises(ValueError):
            inspect_requests(document)

    def test_rejects_broken_reference_missing_envelope_or_login(self):
        for change in ('reference', 'envelope', 'login', 'duplicate'):
            document = copy.deepcopy(fixture())
            if change == 'reference':
                document['definitions'].pop('Params0')
            elif change == 'envelope':
                document['oneOf'][0]['required'].remove('params')
            elif change == 'login':
                document['definitions']['Params6']['oneOf'][0]['properties']['type']['enum'] = ['apiKey']
            else:
                document['oneOf'].append(copy.deepcopy(document['oneOf'][0]))
            with self.subTest(change=change), self.assertRaises(ValueError):
                inspect_requests(document)

    def test_rejects_external_reference(self):
        with self.assertRaises(ValueError):
            resolve_local({}, 'https://example.invalid/schema.json')


if __name__ == '__main__':
    unittest.main()
