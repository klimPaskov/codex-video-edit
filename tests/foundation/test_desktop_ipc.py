"""Public IPC contract regression tests; no Electron launch or private media."""
from copy import deepcopy
import json
from pathlib import Path
import unittest

from jsonschema import Draft202012Validator

ROOT = Path(__file__).resolve().parents[2]


class DesktopIpcContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.schema = json.loads((ROOT / 'schemas/desktop_ipc.schema.json').read_text(encoding='utf8'))
        Draft202012Validator.check_schema(cls.schema)
        cls.validator = Draft202012Validator(cls.schema)
        cls.frame = json.loads((ROOT / 'examples/desktop_ipc.example.json').read_text(encoding='utf8'))
        cls.summary = json.loads((ROOT / 'examples/media_library.example.json').read_text(encoding='utf8'))['summary']

    def valid(self, value):
        self.validator.validate(value)

    def invalid(self, value):
        self.assertFalse(self.validator.is_valid(value), repr(value)[:400])

    def test_each_channel_success_and_error(self):
        self.valid(self.frame)
        for channel, values in [('list', [[], [self.summary]]), ('import', [None, self.summary]), ('cancel', [None])]:
            for value in values:
                self.valid({'channel': 'library:' + channel, 'response': {'ok': True, 'value': value}})
        for channel in ['list', 'import', 'cancel', 'frame']:
            exchange = {'channel': 'library:' + channel, 'response': {'ok': False, 'message': 'Try another file.'}}
            if channel == 'frame':
                exchange['payload'] = self.frame['payload']
            self.valid(exchange)

    def test_undefined_requests_are_absent_not_null_or_paths(self):
        for channel in ['list', 'import', 'cancel']:
            for payload in [None, {}, {'path': '/private/video.mkv'}]:
                self.invalid({'channel': 'library:' + channel, 'payload': payload, 'response': {'ok': False, 'message': ''}})
        value = deepcopy(self.frame)
        value['payload']['path'] = '/private/video.mkv'
        self.invalid(value)
        value = deepcopy(self.frame)
        value['payload']['id'] = '../private/video.mkv'
        self.invalid(value)

    def test_request_bounds_and_unknown_channels(self):
        for time in [-1, 0.5, 9007199254740992, '0', None]:
            value = deepcopy(self.frame)
            value['payload']['timeUs'] = time
            self.invalid(value)
        value = deepcopy(self.frame)
        value['channel'] = 'library:delete'
        self.invalid(value)

    def test_wrong_reply_types_and_excess_fields(self):
        for channel, wrong in [('list', None), ('import', []), ('cancel', {}), ('frame', self.summary)]:
            value = {'channel': 'library:' + channel, 'response': {'ok': True, 'value': wrong}}
            if channel == 'frame':
                value['payload'] = self.frame['payload']
            self.invalid(value)
        for extra in ['message', 'path', 'stderr']:
            value = deepcopy(self.frame)
            value['response'][extra] = '/private/example'
            self.invalid(value)
        value = deepcopy(self.frame)
        value['response']['value']['path'] = '/private/example'
        self.invalid(value)
        self.invalid({'channel': 'library:list', 'response': {'ok': False, 'message': ''}})
        self.invalid({'channel': 'library:list', 'response': {'ok': False, 'message': 'x' * 241}})
        self.invalid({'channel': 'library:list', 'response': {'ok': False, 'message': '', 'value': []}})

    def test_frame_and_summary_limits(self):
        for field, bad in [('width', 16777217), ('height', 0), ('rgbaBase64', 'not base64!?')]:
            value = deepcopy(self.frame)
            value['response']['value'][field] = bad
            self.invalid(value)
        # Avoid allocating an 89 MB test string: test the declared string bound independently.
        frame_string = self.schema['$defs']['frame']['properties']['rgbaBase64']
        self.assertEqual(frame_string['maxLength'], 4 * ((16777216 * 4 + 2) // 3))
        for name in ['/private/video.mkv', 'C:\\private\\video.mkv', 'bad\x00name', 'x' * 256]:
            summary = deepcopy(self.summary)
            summary['name'] = name
            self.invalid({'channel': 'library:import', 'response': {'ok': True, 'value': summary}})
        self.invalid({'channel': 'library:list', 'response': {'ok': True, 'value': [self.summary, self.summary]}})

    def test_preferences_channels_and_schema_consistency(self):
        preferences_schema = json.loads((ROOT / 'schemas/desktop_preferences.schema.json').read_text(encoding='utf8'))
        for field in ['type', 'additionalProperties', 'required', 'properties']:
            self.assertEqual(self.schema['$defs']['preferences'][field], preferences_schema[field])
        for scale in [1, 1.25, 1.5, 2]:
            value = {'interfaceScale': scale}
            self.valid({'channel': 'preferences:get', 'response': {'ok': True, 'value': value}})
            self.valid({'channel': 'preferences:set', 'payload': value, 'response': {'ok': True, 'value': value}})
        self.valid({'channel': 'preferences:get', 'response': {'ok': False, 'message': 'Settings could not be loaded.'}})
        self.valid({'channel': 'preferences:set', 'payload': {'interfaceScale': 1}, 'response': {'ok': False, 'message': 'Settings could not be saved.'}})

    def test_preferences_reject_payload_and_reply_drift(self):
        valid = {'interfaceScale': 1.25}
        for payload in [None, {}, {'interfaceScale': 1}]:
            self.invalid({'channel': 'preferences:get', 'payload': payload, 'response': {'ok': True, 'value': valid}})
        self.invalid({'channel': 'preferences:set', 'response': {'ok': True, 'value': valid}})
        for wrong in [None, {}, [], {'interfaceScale': 3}, {'interfaceScale': '1'}, {'interfaceScale': True}, {'interfaceScale': 1, 'path': '/private/settings.json'}]:
            self.invalid({'channel': 'preferences:set', 'payload': wrong, 'response': {'ok': True, 'value': valid}})
            self.invalid({'channel': 'preferences:get', 'response': {'ok': True, 'value': wrong}})
            self.invalid({'channel': 'preferences:set', 'payload': valid, 'response': {'ok': True, 'value': wrong}})

    def project_view(self):
        return {
            'id': '11111111-1111-4111-8111-111111111111', 'name': 'Synthetic project',
            'stage': 'record_import', 'revisionId': '22222222-2222-4222-8222-222222222222',
            'source': deepcopy(self.summary),
            'timeline': {'id': '33333333-3333-4333-8333-333333333333', 'durationUs': 1001000,
                         'frameRate': {'numerator': 30000, 'denominator': 1001}},
        }

    def project_exchange(self, channel, view=None):
        view = self.project_view() if view is None else view
        result = {'channel': 'projects:' + channel,
                  'response': {'ok': True, 'value': [view] if channel == 'list' else view}}
        if channel != 'list':
            result['payload'] = {'id': view['source']['id'] if channel == 'create' else view['id']}
            if channel == 'navigate':
                result['payload']['stage'] = view['stage']
        return result

    def test_project_channels_success_errors_and_five_stages(self):
        for channel in ['list', 'create', 'open', 'navigate']:
            exchange = self.project_exchange(channel)
            self.valid(exchange)
            exchange['response'] = {'ok': False, 'message': 'Project could not be opened.'}
            self.valid(exchange)
        self.valid({'channel': 'projects:list', 'response': {'ok': True, 'value': []}})
        for stage in ['record_import', 'auto_edit', 'edit', 'review', 'export']:
            view = self.project_view()
            view['stage'] = stage
            self.valid(self.project_exchange('navigate', view))

    def test_project_requests_require_exact_ids_and_no_paths(self):
        for channel in ['create', 'open', 'navigate']:
            for payload in [None, {}, {'id': '../private/project'}, {'path': '/private/project.json'}]:
                exchange = self.project_exchange(channel)
                exchange['payload'] = payload
                self.invalid(exchange)
            for key in ['path', 'projectRoot', 'originalPath']:
                exchange = self.project_exchange(channel)
                exchange['payload'][key] = '/private/project'
                self.invalid(exchange)
            exchange = self.project_exchange(channel)
            del exchange['payload']
            self.invalid(exchange)
        for payload in [None, {}, {'id': self.project_view()['id']}]:
            exchange = self.project_exchange('list')
            exchange['payload'] = payload
            self.invalid(exchange)
        for stage in ['home', 'qa', 'complete', 'delete', None, 0]:
            exchange = self.project_exchange('navigate')
            exchange['payload']['stage'] = stage
            self.invalid(exchange)

    def test_project_view_is_path_free_bounded_and_strict(self):
        for key in ['originalPath', 'managedPath', 'projectRoot', 'source_probe']:
            view = self.project_view()
            view[key] = '/private/source'
            self.invalid(self.project_exchange('open', view))
        for name in ['/private/video', 'C:\\private\\video', 'bad\x00name', '', 'x' * 161]:
            view = self.project_view()
            view['name'] = name
            self.invalid(self.project_exchange('open', view))
        for bad in [0, -1, 0.5, 9007199254740992, '30000', True, None]:
            for key in ['numerator', 'denominator']:
                view = self.project_view()
                view['timeline']['frameRate'][key] = bad
                self.invalid(self.project_exchange('open', view))
            view = self.project_view()
            view['timeline']['durationUs'] = bad
            self.invalid(self.project_exchange('open', view))
        for location in ['source', 'timeline']:
            view = self.project_view()
            view[location]['path'] = '/private/source'
            self.invalid(self.project_exchange('open', view))
        view = self.project_view()
        self.invalid({'channel': 'projects:list', 'response': {'ok': True, 'value': [view, view]}})
        listing = next(branch for branch in self.schema['oneOf'] if branch['properties']['channel'].get('const') == 'projects:list')
        self.assertEqual(listing['properties']['response']['oneOf'][1]['properties']['value']['maxItems'], 1000)
        self.invalid({'channel': 'projects:delete', 'payload': {'id': view['id']}, 'response': {'ok': True, 'value': view}})


if __name__ == '__main__':
    unittest.main()
