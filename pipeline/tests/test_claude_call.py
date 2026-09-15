import json
import subprocess
from unittest import mock

import pytest

from pipeline import claude_call


def _completed(payload: dict, returncode: int = 0):
    return subprocess.CompletedProcess(
        args=[], returncode=returncode, stdout=json.dumps(payload), stderr=""
    )


def test_call_returns_structured_output():
    payload = {"is_error": False, "structured_output": {"x": 1}}
    with mock.patch("subprocess.run", return_value=_completed(payload)) as run:
        result = claude_call.call("hi", {"type": "object"})
    assert result == {"x": 1}
    cmd = run.call_args.args[0]
    assert cmd[:2] == ["claude", "-p"]
    assert "--json-schema" in cmd
    assert run.call_args.kwargs["input"] == "hi"


def test_call_raises_on_error_payload():
    payload = {"is_error": True, "result": "boom", "structured_output": None}
    with mock.patch("subprocess.run", return_value=_completed(payload)):
        with pytest.raises(claude_call.ClaudeCallError):
            claude_call.call("hi", {"type": "object"})


def test_call_waits_on_usage_limit_then_succeeds():
    limited = {"is_error": True, "result": "You've hit your usage limit", "structured_output": None}
    ok = {"is_error": False, "structured_output": {"ok": True}}
    with mock.patch("subprocess.run", side_effect=[_completed(limited), _completed(ok)]), \
         mock.patch("time.sleep") as sleep:
        result = claude_call.call("hi", {"type": "object"})
    assert result == {"ok": True}
    sleep.assert_called_once_with(15 * 60)


def test_call_raises_on_subprocess_timeout():
    with mock.patch("subprocess.run", side_effect=subprocess.TimeoutExpired(cmd="claude", timeout=1)):
        with pytest.raises(claude_call.ClaudeCallError):
            claude_call.call("hi", {"type": "object"})


def test_session_limit_message_triggers_wait():
    limited = {"is_error": True, "result": "You've hit your session limit · resets 8:10pm (Asia/Seoul)", "structured_output": None}
    ok = {"is_error": False, "structured_output": {"ok": True}}
    with mock.patch("subprocess.run", side_effect=[_completed(limited), _completed(ok)]), \
         mock.patch("time.sleep") as sleep:
        assert claude_call.call("hi", {"type": "object"}) == {"ok": True}
    sleep.assert_called_once()
