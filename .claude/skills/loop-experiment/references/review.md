# Review — phase 7

The reviewer's job is to find the reading of the data that contradicts the conclusion. It is judged on whether it found one, not on whether it approved.

## The reviewer reads the artifacts, not the report

**A reviewer given only the rendered output cannot catch a number that never came from the run.** The report is internally consistent by construction — that is what writing it does — so consistency is not evidence of anything.

The review input is the study directory: `prereg.txt`, `truth/`, `runs/`, `notes.md`, and the report. A reviewer without access to `runs/` is doing copy-editing.

This is the precise failure of the framework this skill's vocabulary comes from: its reviewer is a vision model reading the compiled PDF, with no path back to the raw logs. See `prior-art.md`.

## What the reviewer is asked

Not "is this good?" — that question produces a score and no information. Ask for specific attacks:

1. **Find a number in the report that is not supported by the artifacts.** Name the file you checked.
2. **Find a reading of this data that supports the opposite conclusion.** If none exists, say what would have to be different for one to exist.
3. **Name a confound the sweep missed.** Not from the catalogue — one specific to this study's design.
4. **Check the refutation condition was answered as written**, not paraphrased.
5. **Check the conclusion's scope against the sample.** Does the prose imply more than `n` supports?
6. **Identify the over-reading** a reader will take from this that the data does not support.

Each answer cites a file. A review with no citations is an opinion about prose.

## Diversity beats redundancy

Where the study warrants more than one reviewer, give them **different lenses**, not the same question repeated: one attacks the measurement, one attacks the statistics, one attacks the causal story. Three copies of "any problems?" cover one failure surface three times.

Kill a finding at `Math.ceil(N / 2)` refutations, never a literal `2` — that is silently wrong the moment width becomes 5.

## The reviewer must be able to reject

A review step that has never returned "this does not hold" is not a gate, and its approvals carry no information. If reviews always pass, check whether the reviewer can see the artifacts at all — and whether anything in the pipeline actually stops on a rejection, or merely records one.

**A rejection must halt the study.** In the framework this vocabulary came from, the rule "never terminate below a review score of 6" is a sentence in a prompt with no code enforcing it: nothing would stop a run that ignored its own reviewer. If the rejection path is a request rather than a control, there is no gate — only a log entry.

## Output

```
VERDICT             holds / holds with stated limits / does not hold
UNSUPPORTED         numbers with no artifact backing, named
ALTERNATIVE READING the contradicting interpretation, or why none exists
MISSED CONFOUND     specific to this design
SCOPE               whether the conclusion exceeds the sample
OVER-READING        what a reader will wrongly take from this
```

"Holds with stated limits" is the common and respectable outcome. It means the result survived attack at the sample size it had — which is what an honest study usually earns, and considerably more than most published numbers can claim.
