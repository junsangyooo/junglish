WORD_CLEAN = {
    "type": "object",
    "properties": {
        "reject": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["reject"],
    "additionalProperties": False,
}

PATTERN_LIST = {
    "type": "object",
    "properties": {
        "patterns": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string"},
                    "difficulty": {"type": "integer", "minimum": 1, "maximum": 5},
                    "topic": {"type": "string"},
                },
                "required": ["pattern", "difficulty", "topic"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["patterns"],
    "additionalProperties": False,
}

_WORD = {
    "type": "object",
    "properties": {
        "word": {"type": "string"},
        "pos": {"type": "string"},
        "ipa": {"type": "string"},
        "meaning_ko": {"type": "string"},
        "example_work": {"type": "string"},
        "example_work_ko": {"type": "string"},
        "example_daily": {"type": "string"},
        "example_daily_ko": {"type": "string"},
        "collocations": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 4},
    },
    "required": ["word", "pos", "ipa", "meaning_ko", "example_work", "example_work_ko",
                 "example_daily", "example_daily_ko", "collocations"],
    "additionalProperties": False,
}

_PATTERN = {
    "type": "object",
    "properties": {
        "pattern": {"type": "string"},
        "meaning_ko": {"type": "string"},
        "grammar_note_ko": {"type": "string"},
        "register": {"type": "string", "enum": ["formal", "neutral", "casual"]},
        "example_1": {"type": "string"},
        "example_1_ko": {"type": "string"},
        "example_2": {"type": "string"},
        "example_2_ko": {"type": "string"},
        "cloze_sentence": {"type": "string"},
        "cloze_answer": {"type": "string"},
    },
    "required": ["pattern", "meaning_ko", "grammar_note_ko", "register", "example_1", "example_1_ko",
                 "example_2", "example_2_ko", "cloze_sentence", "cloze_answer"],
    "additionalProperties": False,
}

_LINE = {
    "type": "object",
    "properties": {
        "speaker": {"type": "string"},
        "text": {"type": "string"},
        "text_ko": {"type": "string"},
    },
    "required": ["speaker", "text", "text_ko"],
    "additionalProperties": False,
}

_QUIZ = {
    "type": "object",
    "properties": {
        "line_index": {"type": "integer", "minimum": 0},
        "blank_text": {"type": "string"},
        "answer": {"type": "string"},
        "pattern": {"type": "string"},
    },
    "required": ["line_index", "blank_text", "answer", "pattern"],
    "additionalProperties": False,
}

DAY = {
    "type": "object",
    "properties": {
        "words": {"type": "array", "items": _WORD},
        "patterns": {"type": "array", "items": _PATTERN},
        "dialogue": {
            "type": "object",
            "properties": {
                "title_ko": {"type": "string"},
                "situation_ko": {"type": "string"},
                "lines": {"type": "array", "items": _LINE, "minItems": 6, "maxItems": 10},
                "quiz": {"type": "array", "items": _QUIZ, "minItems": 3, "maxItems": 3},
            },
            "required": ["title_ko", "situation_ko", "lines", "quiz"],
            "additionalProperties": False,
        },
    },
    "required": ["words", "patterns", "dialogue"],
    "additionalProperties": False,
}

WORDS_CHUNK = {
    "type": "object",
    "properties": {
        "words": {"type": "array", "items": _WORD},
    },
    "required": ["words"],
    "additionalProperties": False,
}

PATTERNS_CHUNK = {
    "type": "object",
    "properties": {
        "patterns": {"type": "array", "items": _PATTERN},
    },
    "required": ["patterns"],
    "additionalProperties": False,
}

_DIALOGUE_ITEM = {
    "type": "object",
    "properties": {
        "day": {"type": "integer"},
        "title_ko": {"type": "string"},
        "situation_ko": {"type": "string"},
        "lines": {"type": "array", "items": _LINE, "minItems": 6, "maxItems": 10},
        "quiz": {"type": "array", "items": _QUIZ, "minItems": 3, "maxItems": 3},
    },
    "required": ["day", "title_ko", "situation_ko", "lines", "quiz"],
    "additionalProperties": False,
}

DIALOGUES_CHUNK = {
    "type": "object",
    "properties": {
        "dialogues": {"type": "array", "items": _DIALOGUE_ITEM},
    },
    "required": ["dialogues"],
    "additionalProperties": False,
}
