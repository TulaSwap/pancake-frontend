/* eslint-disable no-param-reassign */
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { maxBy } from 'lodash'
import { Bet, PredictionsState, PredictionStatus, Round, RoundData } from 'state/types'
import {
  getRound,
  makeFutureRoundResponse,
  transformRoundResponse,
  getUserPositions,
  transformBetResponse,
  getBet,
} from './helpers'

const initialState: PredictionsState = {
  status: PredictionStatus.INITIAL,
  isLoading: false,
  isHistoryPaneOpen: false,
  isChartPaneOpen: false,
  isFetchingHistory: false,
  currentEpoch: 0,
  currentRoundStartBlockNumber: 0,
  intervalBlocks: 100,
  bufferBlocks: 2,
  minBetAmount: '1000000000000000',
  rounds: {},
  bets: [],
}

// Thunks
export const updateRound = createAsyncThunk<Round, { id: string }>('predictions/updateRound', async ({ id }) => {
  const response = await getRound(id)
  const round = transformRoundResponse(response)

  return round
})

export const updateBet = createAsyncThunk<Bet, { id: string }>('predictions/updateBet', async ({ id }) => {
  const response = await getBet(id)
  const bet = transformBetResponse(response)
  return bet
})

export const showHistory = createAsyncThunk<Bet[], { account: string }>(
  'predictions/fetchHistory',
  async ({ account }) => {
    const response = await getUserPositions(account)
    const bets = response.map(transformBetResponse)

    return bets
  },
)

export const predictionsSlice = createSlice({
  name: 'predictions',
  initialState,
  reducers: {
    setHistoryPaneState: (state, action: PayloadAction<boolean>) => {
      state.isHistoryPaneOpen = action.payload
    },
    setChartPaneState: (state, action: PayloadAction<boolean>) => {
      state.isChartPaneOpen = action.payload
    },
    initialize: (state, action: PayloadAction<PredictionsState>) => {
      return action.payload
    },
    updateRounds: (state, action: PayloadAction<RoundData>) => {
      const newRoundData = { ...state.rounds, ...action.payload }
      const incomingRounds = Object.values(action.payload)
      const incomingCurrentRound = maxBy(incomingRounds, 'epoch')

      if (state.currentEpoch !== incomingCurrentRound.epoch) {
        const rounds = Object.values(newRoundData)

        // Add new round
        const newestRound = maxBy(rounds, 'epoch')
        const futureRound = transformRoundResponse(
          makeFutureRoundResponse(newestRound.epoch + 1, newestRound.startBlock + state.intervalBlocks),
        )

        newRoundData[futureRound.id] = futureRound
      }

      state.currentEpoch = incomingCurrentRound.epoch
      state.currentRoundStartBlockNumber = incomingCurrentRound.startBlock
      state.rounds = newRoundData
    },
    setCurrentEpoch: (state, action: PayloadAction<number>) => {
      state.currentEpoch = action.payload
    },
  },
  extraReducers: (builder) => {
    // Update Round
    builder.addCase(updateRound.fulfilled, (state, action) => {
      const { payload: round } = action
      state.rounds[round.id] = round
    })

    // Update Bet
    builder.addCase(updateBet.fulfilled, (state, action) => {
      state.bets = [...state.bets.filter((bet) => bet.id !== action.payload.id), action.payload]
    })

    // Show History
    builder.addCase(showHistory.pending, (state) => {
      state.isFetchingHistory = true
    })
    builder.addCase(showHistory.rejected, (state) => {
      state.isFetchingHistory = false
      state.isHistoryPaneOpen = true
    })
    builder.addCase(showHistory.fulfilled, (state, action) => {
      state.isFetchingHistory = false
      state.isHistoryPaneOpen = true
      state.bets = action.payload
    })
  },
})

// Actions
export const {
  setChartPaneState,
  setHistoryPaneState,
  updateRounds,
  setCurrentEpoch,
  initialize,
} = predictionsSlice.actions

export default predictionsSlice.reducer
