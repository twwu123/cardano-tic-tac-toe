use aiken/collection/list
use aiken/crypto.{VerificationKeyHash}
use aiken/primitive/bytearray
use cardano/address.{VerificationKey}
use cardano/assets.{flatten, lovelace_of}
use cardano/script_context.{ScriptContext}
use cardano/transaction.{
  InlineDatum, Input, Output, OutputReference, Transaction,
}

pub type BoardState {
  // 0 for empty, 1 for X, 2 for O
  cells: ByteArray,
  participant_x: VerificationKeyHash,
  participant_o: VerificationKeyHash,
  current_turn: VerificationKeyHash,
  // 0: pre_bet, 1: ongoing, 2: X won, 3: O won, 4: draw
  current_state: Int,
  bet_amount: Int,
  participant_o_bet: Int,
  participant_x_bet: Int,
}

pub type Redeemer {
  ProgressGame(ProgressGame)
  CancelGame
  EndGame
}

// Every action needs to specify a move position (0-8)
pub type ProgressGame {
  Move { position: Int, player: VerificationKeyHash }
  ClaimWin {
    position: Int,
    player: VerificationKeyHash,
    winning_indices: List<Int>,
  }
  ClaimDraw { position: Int, player: VerificationKeyHash }
  Bet { player: VerificationKeyHash }
  StartGame
}

validator tic_tac_toe {
  spend(
    datum: Option<BoardState>,
    redeemer: Redeemer,
    utxo: OutputReference,
    self: Transaction,
  ) {
    expect Some(board_state) = datum
    when redeemer is {
      ProgressGame(progress_game) -> {
        // These checks will ensure a single thread of UTxOs to represent a game
        expect Some(own_utxo) =
          self.inputs
            |> list.find(
                fn(input: Input) -> Bool { input.output_reference == utxo },
              )
        expect [next_utxo] =
          self.outputs
            |> list.filter(
                fn(output) -> Bool { output.address == own_utxo.output.address },
              )

        expect InlineDatum(new_utxo_data) = next_utxo.datum
        expect new_board_state: BoardState = new_utxo_data
        when progress_game is {
          Move { position, player } -> {
            expect self.extra_signatories |> list.has(player)
            expect board_state.current_state == 1
            validate_move(board_state, new_board_state, position, player, 1)
          }
          ClaimWin { position, player, winning_indices } -> {
            expect self.extra_signatories |> list.has(player)
            expect board_state.current_state == 1
            let expected_new_game_state =
              if player == board_state.participant_x {
                2
              } else if player == board_state.participant_o {
                3
              } else {
                fail @"invalid player credential"
              }
            validate_move(
              board_state,
              new_board_state,
              position,
              player,
              expected_new_game_state,
            ) && check_winning_state(new_board_state, winning_indices, player)
          }
          ClaimDraw { position, player } -> {
            expect self.extra_signatories |> list.has(player)
            expect board_state.current_state == 1
            validate_move(board_state, new_board_state, position, player, 4) && bytearray.xor_bytes(
              new_board_state.cells,
              #[0, 0, 0, 0, 0, 0, 0, 0, 0],
              False,
            ) == new_board_state.cells
          }
          Bet { player } -> {
            expect self.extra_signatories |> list.has(player)
            expect board_state.current_state == 0
            let state_check =
              if player == board_state.participant_x {
                new_board_state == BoardState {
                  ..board_state,
                  participant_x_bet: board_state.bet_amount,
                }
              } else if player == board_state.participant_o {
                new_board_state == BoardState {
                  ..board_state,
                  participant_o_bet: board_state.bet_amount,
                }
              } else {
                fail @"invalid player credential"
              }
            expect
              lovelace_of(next_utxo.value) - lovelace_of(own_utxo.output.value) == board_state.bet_amount
            // Checking that the flanttened asset lists have length 1 checks that they only contain ADA (lovelaces)
            expect list.length(flatten(next_utxo.value)) == 1
            expect list.length(flatten(own_utxo.output.value)) == 1
            state_check
          }
          StartGame -> {
            expect board_state.current_state == 0
            expect board_state.participant_x_bet == board_state.bet_amount
            expect board_state.participant_o_bet == board_state.bet_amount
            new_board_state == BoardState { ..board_state, current_state: 1 }
          }
        }
      }
      CancelGame -> {
        expect board_state.current_state == 0
        // Ensure bets are refunded to both players
        if board_state.participant_o_bet == 0 && board_state.participant_x_bet == 0 {
          True
        } else {
          let participant_o_outputs =
            self.outputs
              |> list.filter(
                  fn(output: Output) -> Bool {
                    when output.address.payment_credential is {
                      VerificationKey(key_hash) ->
                        key_hash == board_state.participant_o
                      _ -> False
                    }
                  },
                )
          let participant_x_outputs =
            self.outputs
              |> list.filter(
                  fn(output: Output) -> Bool {
                    when output.address.payment_credential is {
                      VerificationKey(key_hash) ->
                        key_hash == board_state.participant_x
                      _ -> False
                    }
                  },
                )
          let participant_o_refund =
            participant_o_outputs
              |> list.foldr(
                  0,
                  fn(output: Output, acc: Int) -> Int {
                    acc + lovelace_of(output.value)
                  },
                )
          let participant_x_refund =
            participant_x_outputs
              |> list.foldr(
                  0,
                  fn(output: Output, acc: Int) -> Int {
                    acc + lovelace_of(output.value)
                  },
                )
          expect participant_o_refund >= board_state.participant_o_bet
          expect participant_x_refund >= board_state.participant_x_bet
          True
        }
      }
      EndGame -> {
        if board_state.current_state == 2 {
          expect self.extra_signatories |> list.has(board_state.participant_x)
        } else if board_state.current_state == 3 {
          expect self.extra_signatories |> list.has(board_state.participant_o)
        } else if board_state.current_state == 4 {
          let participant_o_outputs =
            self.outputs
              |> list.filter(
                  fn(output: Output) -> Bool {
                    when output.address.payment_credential is {
                      VerificationKey(key_hash) ->
                        key_hash == board_state.participant_o
                      _ -> False
                    }
                  },
                )
          let participant_x_outputs =
            self.outputs
              |> list.filter(
                  fn(output: Output) -> Bool {
                    when output.address.payment_credential is {
                      VerificationKey(key_hash) ->
                        key_hash == board_state.participant_x
                      _ -> False
                    }
                  },
                )
          let participant_o_refund =
            participant_o_outputs
              |> list.foldr(
                  0,
                  fn(output: Output, acc: Int) -> Int {
                    acc + lovelace_of(output.value)
                  },
                )
          let participant_x_refund =
            participant_x_outputs
              |> list.foldr(
                  0,
                  fn(output: Output, acc: Int) -> Int {
                    acc + lovelace_of(output.value)
                  },
                )
          expect participant_o_refund >= board_state.participant_o_bet
          expect participant_x_refund >= board_state.participant_x_bet
        } else {
          fail @"game is not in a terminal state"
        }
        True
      }
    }
  }

  else(_ctx: ScriptContext) {
    fail @"unsupported script purpose"
  }
}

pub fn check_winning_state(
  state: BoardState,
  winning_indices: List<Int>,
  winner: VerificationKeyHash,
) -> Bool {
  // Example logic to check for a winning state in Tic-Tac-Toe
  let winning_combinations =
    [
      // rows
      [0, 1, 2], [3, 4, 5], [6, 7, 8],
      // columns
      [0, 3, 6], [1, 4, 7], [2, 5, 8],
      // diagonals
      [0, 4, 8], [2, 4, 6],
    ]
  let winner_value =
    if winner == state.participant_x {
      1
    } else if winner == state.participant_o {
      2
    } else {
      fail @"invalid winner credential"
    }
  let indices_check = winning_combinations |> list.has(winning_indices)
  let winner_check =
    winning_indices
      |> list.all(
          fn(index: Int) -> Bool {
            bytearray.at(state.cells, index) == winner_value
          },
        )
  indices_check && winner_check
}

pub fn validate_move(
  state: BoardState,
  new_state: BoardState,
  position: Int,
  player: VerificationKeyHash,
  expected_new_game_state: Int,
) -> Bool {
  // Ensure the move is valid
  expect position >= 0 && position < 9
  expect bytearray.at(state.cells, position) == 0
  expect state.current_turn == player

  // Update the board state
  let player_value =
    if player == state.participant_x {
      1
    } else if player == state.participant_o {
      2
    } else {
      fail @"invalid player credential"
    }

  // Determine next turn
  let next_turn =
    if player == state.participant_x {
      state.participant_o
    } else {
      state.participant_x
    }

  let xor_cells = state.cells |> bytearray.xor_bytes(new_state.cells, False)
  // Somewhat hacky way to check that only the specified position has changed
  // by using xor and comparing slices
  let check_xor =
    bytearray.slice(xor_cells, 0, position - 1) == bytearray.from_int_little_endian(
      0,
      position,
    ) && bytearray.slice(xor_cells, position + 1, 8) == bytearray.from_int_little_endian(
      0,
      9 - position - 1,
    )

  // Validate new state
  let expected_new_state: BoardState =
    BoardState {
      ..state,
      cells: new_state.cells,
      current_turn: next_turn,
      current_state: expected_new_game_state,
    }
  (expected_new_state == new_state)? && (bytearray.at(xor_cells, position) == player_value)? && check_xor?
}
