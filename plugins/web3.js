const Web3 = require('web3')

export default (context, inject) => {
  const web3 = new Web3(Web3.givenProvider || 'ws://localhost:8545')
  const fws = new web3.eth.Contract(
    process.env.FWS_ABI,
    process.env.FWS_ADDRESS
  )

  inject('web3', web3)
  inject('fws', fws)
}
