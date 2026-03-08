use std::sync::OnceLock;

use regex::Regex;

static FILLER_RE: OnceLock<Regex> = OnceLock::new();
static MULTI_WORD_FILLER_RE: OnceLock<Regex> = OnceLock::new();
static LIKE_FILLER_RE: OnceLock<Regex> = OnceLock::new();
static MULTI_SPACE_RE: OnceLock<Regex> = OnceLock::new();
static DOUBLE_COMMA_RE: OnceLock<Regex> = OnceLock::new();

fn filler_re() -> &'static Regex {
    FILLER_RE.get_or_init(|| {
        Regex::new(r"(?i)\b(um|uh|uhh|umm|hmm|hm|er|err|ah|ahh|uh-huh)\b[,]?\s*").unwrap()
    })
}

fn multi_word_filler_re() -> &'static Regex {
    MULTI_WORD_FILLER_RE.get_or_init(|| {
        Regex::new(r"(?i)\b(you know|I mean)\b[,]?\s*").unwrap()
    })
}

fn like_filler_re() -> &'static Regex {
    LIKE_FILLER_RE.get_or_init(|| {
        Regex::new(r"(?i)(?:^|,\s*)\blike\b\s*,\s*").unwrap()
    })
}

fn multi_space_re() -> &'static Regex {
    MULTI_SPACE_RE.get_or_init(|| Regex::new(r" {2,}").unwrap())
}

fn double_comma_re() -> &'static Regex {
    DOUBLE_COMMA_RE.get_or_init(|| Regex::new(r",\s*,").unwrap())
}

pub fn remove_filler_words(text: &str) -> String {
    if text.is_empty() {
        return String::new();
    }

    let result = filler_re().replace_all(text, "");
    let result = multi_word_filler_re().replace_all(&result, "");
    let result = like_filler_re().replace_all(&result, " ");
    let result = double_comma_re().replace_all(&result, ",");
    let result = multi_space_re().replace_all(&result, " ");

    result.trim().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn single_filler_at_start() {
        assert_eq!(remove_filler_words("Um I think so"), "I think so");
    }

    #[test]
    fn single_filler_mid_sentence() {
        assert_eq!(remove_filler_words("I was um thinking"), "I was thinking");
    }

    #[test]
    fn filler_with_comma() {
        assert_eq!(remove_filler_words("Um, I think so"), "I think so");
    }

    #[test]
    fn multiple_fillers() {
        assert_eq!(
            remove_filler_words("Um uh I was, like, uh, thinking"),
            "I was thinking"
        );
    }

    #[test]
    fn case_insensitive() {
        assert_eq!(remove_filler_words("UM I think so"), "I think so");
    }

    #[test]
    fn no_false_positive_human() {
        assert_eq!(
            remove_filler_words("The human was kind"),
            "The human was kind"
        );
    }

    #[test]
    fn no_false_positive_like_verb() {
        assert_eq!(remove_filler_words("I like cats"), "I like cats");
    }

    #[test]
    fn filler_like_with_commas() {
        assert_eq!(
            remove_filler_words("It was, like, amazing"),
            "It was amazing"
        );
    }

    #[test]
    fn multi_word_you_know() {
        assert_eq!(
            remove_filler_words("You know, it was great"),
            "it was great"
        );
    }

    #[test]
    fn multi_word_i_mean() {
        assert_eq!(
            remove_filler_words("I mean, that's fine"),
            "that's fine"
        );
    }

    #[test]
    fn empty_string() {
        assert_eq!(remove_filler_words(""), "");
    }

    #[test]
    fn no_fillers_present() {
        assert_eq!(remove_filler_words("Hello world"), "Hello world");
    }

    #[test]
    fn all_fillers() {
        assert_eq!(remove_filler_words("Um uh er"), "");
    }

    #[test]
    fn preserves_capitalization_after_removal() {
        assert_eq!(remove_filler_words("Um, The cat sat"), "The cat sat");
    }

    #[test]
    fn double_spaces_collapsed() {
        assert_eq!(remove_filler_words("I  um  think"), "I think");
    }

    #[test]
    fn repeated_filler() {
        assert_eq!(remove_filler_words("Um um um hello"), "hello");
    }
}
