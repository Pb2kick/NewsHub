package com.newshub.backend.news.application;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class NewsCategoryClassifierTest {

    @Test
    void substringsInsideOtherWordsDoNotMatch() {
        // "failure" contains "ai", "officials say" / "said" contain "ai" — must not be Technology.
        assertEquals(NewsCategoryClassifier.TOP_STORIES, NewsCategoryClassifier.classify("",
                "Steering failure caused US tanker to crash into cruise ship in New Orleans, officials say",
                "US investigators blame steering failure for a Mississippi River collision that said again"));
    }

    @Test
    void pollutionIsNotAnElectionStory() {
        assertEquals(NewsCategoryClassifier.TOP_STORIES, NewsCategoryClassifier.classify("",
                "Air pollution worsens across the metro"));
    }

    @Test
    void wholeWordKeywordsStillMatch() {
        assertEquals(NewsCategoryClassifier.TECHNOLOGY, NewsCategoryClassifier.classify("",
                "Philippines establishes national AI council to oversee AI development"));
        assertEquals(NewsCategoryClassifier.ELECTIONS, NewsCategoryClassifier.classify("",
                "Comelec opens voter registration ahead of the 2028 elections"));
        assertEquals(NewsCategoryClassifier.ECONOMY, NewsCategoryClassifier.classify("",
                "Inflation slows as peso strengthens against the dollar"));
        assertEquals(NewsCategoryClassifier.POLITICS, NewsCategoryClassifier.classify("",
                "Senate passes bill after lawmakers reach compromise"));
    }

    @Test
    void highestScoreWins() {
        // One politics word vs. three election words.
        assertEquals(NewsCategoryClassifier.ELECTIONS, NewsCategoryClassifier.classify("",
                "Senate candidates make final campaign push as voters head to the polls"));
    }

    @Test
    void explicitFeedCategoryTakesPriority() {
        assertEquals(NewsCategoryClassifier.ECONOMY, NewsCategoryClassifier.classify("Business",
                "New AI chip unveiled"));
    }

    @Test
    void nullTextsAreIgnored() {
        assertEquals(NewsCategoryClassifier.TOP_STORIES, NewsCategoryClassifier.classify(null, null, null));
    }
}
