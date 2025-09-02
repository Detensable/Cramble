function blackjackGame() {
    const BACK_CARD = "https://deckofcardsapi.com/static/img/back.png";
    const deckApiUrl = 'https://deckofcardsapi.com/api/deck';
    const auth = firebase.auth();
    const db = firebase.database();

    return {
        deckId: null,
        playerCards: [],
        dealerCards: [],
        splitHands: [], // store split hands
        activeHandIndex: 0,
        playerScore: 0,
        dealerScore: 0,
        gameStarted: false,
        playerTurn: true,
        message: 'Loading balance...',
        betAmount: 0,
        points: 0,
        user: null,

        init() {
            auth.onAuthStateChanged(user => {
                if (!user) {
                    window.location.href = "index.html";
                } else {
                    this.user = user;
                    db.ref("users/" + user.uid + "/points").once("value").then(snapshot => {
                        const saved = snapshot.val();
                        this.points = saved !== null ? parseFloat(saved) : 1000.00;
                        this.message = 'Click "Deal Cards" to start the game.';
                    });
                }
            });
        },

        async startGame() {
            if (this.betAmount <= 0 || this.betAmount > this.points) {
                this.message = "Invalid bet amount.";
                return;
            }

            try {
                const deckResponse = await fetch(`${deckApiUrl}/new/shuffle/?deck_count=6`);
                const deckData = await deckResponse.json();
                this.deckId = deckData.deck_id;
                this.gameStarted = true;
                this.playerTurn = true;
                this.message = "Game started! Your turn.";
                this.points -= this.betAmount;
                this.updateBalance();
                await this.dealInitialCards();
            } catch (error) {
                console.error('Error starting game:', error);
                this.message = 'Error starting game. Please try again later.';
            }
        },

        async dealInitialCards() {
            try {
                this.playerCards = [];
                this.dealerCards = [];
                this.splitHands = [];
                this.activeHandIndex = 0;

                this.playerCards.push(await this.drawCard());
                this.dealerCards.push({ image: BACK_CARD, showback: true });
                this.playerCards.push(await this.drawCard());
                this.dealerCards.push(await this.drawCard());
                this.updateScores();
            } catch (error) {
                console.error('Error dealing cards:', error);
                this.message = 'Error dealing cards. Please try again later.';
            }
        },

        async drawCard() {
            const cardResponse = await fetch(`${deckApiUrl}/${this.deckId}/draw/?count=1`);
            const cardData = await cardResponse.json();
            if (!cardData.success) throw new Error('Failed to draw card');
            return cardData.cards[0];
        },

        updateScores() {
            this.playerScore = this.calculateScore(this.playerCards);

            if (this.dealerCards[0].showback) {
                const secondCardValue = this.getCardValue(this.dealerCards[1]);
                this.dealerScore = `${secondCardValue} + ?`;
            } else {
                this.dealerScore = this.calculateScore(this.dealerCards);
            }
        },

        getCardValue(card) {
            if (['KING', 'QUEEN', 'JACK'].includes(card.value)) {
                return 10;
            } else if (card.value === 'ACE') {
                return 11;
            } else {
                return parseInt(card.value);
            }
        },

        calculateScore(hand) {
            let lowCount = 0;
            let highCount = 0;
            let oneAce = false;

            hand.forEach(card => {
                if (card.value === 'ACE') {
                    lowCount += 1;
                    if (!oneAce) {
                        highCount += 11;
                        oneAce = true;
                    } else {
                        highCount += 1;
                    }
                } else if (['KING', 'QUEEN', 'JACK'].includes(card.value)) {
                    lowCount += 10;
                    highCount += 10;
                } else {
                    lowCount += parseInt(card.value);
                    highCount += parseInt(card.value);
                }
            });

            return highCount > 21 ? lowCount : highCount;
        },

        // ========== Player Actions ==========

        async hit() {
            this.playerCards.push(await this.drawCard());
            this.updateScores();
            if (this.playerScore > 21) {
                this.message = "Busted!";
                if (this.splitHands.length) {
                    await this.nextSplitHand();
                } else {
                    this.playerTurn = false;
                    this.gameStarted = false;
                }
            }
        },

        async stand() {
            if (this.splitHands.length) {
                await this.nextSplitHand();
            } else {
                this.playerTurn = false;
                this.message = "Dealer's turn.";
                await this.revealDealerCard();
                await this.dealerTurn();
            }
        },

        canDouble() {
            return this.playerCards.length === 2 && this.betAmount <= this.points;
        },

        async doubleDown() {
            if (!this.canDouble()) return;
            this.points -= this.betAmount;
            this.betAmount *= 2;
            this.updateBalance();
            this.message = "You doubled down!";
            this.playerCards.push(await this.drawCard());
            this.updateScores();

            if (this.playerScore > 21) {
                this.message = "You busted after doubling!";
                this.playerTurn = false;
                this.gameStarted = false;
            } else {
                await this.stand();
            }
        },

        canSplit() {
            return (
                this.playerCards.length === 2 &&
                this.getCardValue(this.playerCards[0]) === this.getCardValue(this.playerCards[1]) &&
                this.betAmount <= this.points
            );
        },

        async split() {
            if (!this.canSplit()) return;
            this.points -= this.betAmount;
            this.updateBalance();

            this.splitHands = [
                [this.playerCards[0], await this.drawCard()],
                [this.playerCards[1], await this.drawCard()]
            ];

            this.activeHandIndex = 0;
            this.playerCards = this.splitHands[this.activeHandIndex];
            this.updateScores();
            this.message = "Split! Playing first hand.";
        },

        async nextSplitHand() {
            this.activeHandIndex++;
            if (this.activeHandIndex < this.splitHands.length) {
                this.playerCards = this.splitHands[this.activeHandIndex];
                this.updateScores();
                this.message = `Now playing hand ${this.activeHandIndex + 1}`;
            } else {
                this.playerTurn = false;
                this.message = "Dealer's turn with all split hands.";
                await this.revealDealerCard();
                await this.dealerTurn();
            }
        },

        // ========== Dealer Logic ==========

        async revealDealerCard() {
            const newCard = await this.drawCard();
            this.dealerCards[0] = newCard;
            this.updateScores();
        },

        async dealerTurn() {
            while (typeof this.dealerScore === "number" && this.dealerScore < 17) {
                this.dealerCards.push(await this.drawCard());
                this.updateScores();
            }
            this.checkOutcome();
        },

        checkOutcome() {
            if (this.splitHands.length) {
                this.splitHands.forEach((hand, i) => {
                    const score = this.calculateScore(hand);
                    if (this.dealerScore > 21 && score <= 21) {
                        this.points += this.betAmount * 2;
                        this.message = `Hand ${i + 1}: Dealer busted, you win!`;
                    } else if (score > 21 || this.dealerScore > score) {
                        this.message = `Hand ${i + 1}: Dealer wins.`;
                    } else if (score > this.dealerScore) {
                        this.points += this.betAmount * 2;
                        this.message = `Hand ${i + 1}: You win!`;
                    } else {
                        this.message = `Hand ${i + 1}: Push or dealer wins.`;
                    }
                });
            } else {
                if (this.dealerScore > 21) {
                    this.message = "Dealer busted! You win!";
                    this.points += this.betAmount * 2;
                } else if (this.dealerScore >= this.playerScore) {
                    this.message = "Dealer wins!";
                } else {
                    this.message = "You win!";
                    this.points += this.betAmount * 2;
                }
            }
            this.updateBalance();
            this.gameStarted = false;
        },

        // ========== Balance ==========

        updateBalance() {
            if (this.user) {
                firebase.database().ref("users/" + this.user.uid + "/points").set(this.points);
            }
        },

        depositPoints() {
            if (this.betAmount > 0 && this.betAmount <= this.points) {
                this.message = `Deposited ${this.betAmount.toFixed(2)} points to bet.`;
            } else {
                this.message = "Invalid deposit amount.";
            }
        }
    };
}